import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Fuse from "https://esm.sh/fuse.js@6.6.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Lista de palavras que mudam drasticamente a categoria do produto
// Se o usuário não pediu isso, NÃO devemos trazer produtos que tenham isso.
const PROCESSED_KEYWORDS = [
  "congelad", "congelada", "congelado",
  "frita", "frito", "pré-frita", "pre-frita",
  "empanad", "empanado", "empanada",
  "pronto", "pronta", "nuggets", "hamburguer",
  "lasanha", "pizza"
];

function containsProcessedKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return PROCESSED_KEYWORDS.some(k => lower.includes(k));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { listId, userLocation, radius, targetMarketId, strategy } = await req.json();

    if (!listId) throw new Error("ID da lista obrigatório");

    // 1. Buscar Itens da Lista
    const { data: listItems, error: listError } = await supabase
      .from("list_items")
      .select(`
        id, quantity, product_id,
        products (id, name, brand, measurement)
      `)
      .eq("list_id", listId);

    if (listError) throw listError;
    if (!listItems?.length) throw new Error("Lista vazia");

    // 2. Definir quais mercados analisar
    let marketsToAnalyze = [];

    if (targetMarketId) {
      const { data: market, error: mError } = await supabase
        .from("markets")
        .select("*")
        .eq("id", targetMarketId)
        .single();
      if (mError) throw mError;
      marketsToAnalyze = [market];
    } else {
      if (!userLocation) throw new Error("Localização necessária para busca por raio");

      const { data: allMarkets, error: marketsError } = await supabase
        .from("markets")
        .select("*");
      if (marketsError) throw marketsError;

      marketsToAnalyze = allMarkets.filter(m => {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, m.latitude, m.longitude);
        return dist <= radius;
      });
    }

    if (marketsToAnalyze.length === 0) {
      return new Response(JSON.stringify({ success: true, results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const marketIds = marketsToAnalyze.map(m => m.id);

    // 3. Buscar Preços
    const { data: allPrices, error: pricesError } = await supabase
      .from("market_prices")
      .select(`
        price, market_id, product_id, created_at,
        products (id, name, brand, measurement)
      `)
      .in("market_id", marketIds);

    if (pricesError) throw pricesError;

    // 4. Análise Inteligente
    const results = marketsToAnalyze.map(market => {
      const distance = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, market.latitude, market.longitude)
        : 0;

      const marketPrices = allPrices.filter(p => p.market_id === market.id);

      const marketProductsSearch = new Fuse(marketPrices, {
        keys: ["products.name"],
        threshold: 0.3,
        includeScore: true,
        ignoreLocation: true
      });

      let totalPrice = 0;
      let missingItems = 0;
      let substitutedItems = 0;
      let foundPriceDates: string[] = [];
      const matches: any[] = [];

      listItems.forEach(item => {
        const targetId = item.products.id;
        const targetName = item.products.name;
        const targetBrand = item.products.brand?.toLowerCase().trim();

        // Verifica se o item original é "processado"
        const isTargetProcessed = containsProcessedKeyword(targetName);

        let match = null;
        let isSubstitution = false;
        let matchType = 'missing';

        // Busca todos os candidatos
        const searchResult = marketProductsSearch.search(targetName);

        let candidatesWithScore = searchResult
          .filter(res => res.score !== undefined && res.score < 0.45)
          .map(res => ({ item: res.item, score: res.score || 0 }));

        const exactMatch = marketPrices.find(p => p.product_id === targetId);
        if (exactMatch) {
          const exists = candidatesWithScore.find(c => c.item.product_id === exactMatch.product_id);
          if (!exists) {
            candidatesWithScore.push({ item: exactMatch, score: 0 });
          } else {
            exists.score = 0;
          }
        }

        // --- FILTRO DE SEGURANÇA (Batata vs Batata Congelada) ---
        // Se eu pedi "Batata" (não processado) e o candidato é "Batata Congelada" (processado), REMOVE o candidato.
        if (!isTargetProcessed) {
          candidatesWithScore = candidatesWithScore.filter(c => {
            const isCandidateProcessed = containsProcessedKeyword(c.item.products.name);
            // Se o candidato é processado mas o alvo não era, descarta.
            return !isCandidateProcessed;
          });
        }

        if (candidatesWithScore.length > 0) {

          if (strategy === 'cheapest') {
            // ESTRATÉGIA: MENOR PREÇO
            candidatesWithScore.sort((a, b) => a.item.price - b.item.price);
            match = candidatesWithScore[0].item;

            if (!exactMatch || match.product_id !== exactMatch.product_id) {
              isSubstitution = true;
              matchType = 'cheapest_strategy';
            } else {
              matchType = 'exact_cheapest';
            }

          } else {
            // ESTRATÉGIA: MELHORES MARCAS

            // 1. Melhor score de texto
            const bestScore = Math.min(...candidatesWithScore.map(c => c.score));

            // 2. Margem de tolerância para relevância (agora mais rígida para evitar desvios)
            const tolerance = 0.1;

            // Filtra apenas os que são linguisticamente muito próximos
            const relevantCandidates = candidatesWithScore.filter(c => c.score <= (bestScore + tolerance));

            // 3. Priorização
            if (targetBrand) {
              const brandMatch = relevantCandidates.find(c =>
                c.item.products.brand?.toLowerCase().trim().includes(targetBrand)
              );
              if (brandMatch) {
                match = brandMatch.item;
                matchType = 'brand_variant';
                isSubstitution = true;
              }
            }

            if (!match && relevantCandidates.length > 0) {
              // Ordena pelo MAIOR preço entre os RELEVANTES
              relevantCandidates.sort((a, b) => b.item.price - a.item.price);
              match = relevantCandidates[0].item;

              if (!exactMatch || match.product_id !== exactMatch.product_id) {
                isSubstitution = true;
                matchType = 'best_brand_strategy';
              } else {
                matchType = 'exact_premium';
              }
            }
          }
        }

        if (match) {
          totalPrice += match.price * item.quantity;
          foundPriceDates.push(match.created_at);
          if (isSubstitution) substitutedItems++;

          matches.push({
            listItemId: item.id,
            matchedProductId: match.products.id,
            matchedProductName: match.products.name,
            matchedProductBrand: match.products.brand,
            matchedPrice: match.price,
            originalName: targetName,
            isSubstitution,
            matchType
          });
        } else {
          missingItems++;
        }
      });

      let lastUpdate = new Date().toISOString();
      if (foundPriceDates.length > 0) {
        foundPriceDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        lastUpdate = foundPriceDates[0];
      }

      if (listItems.length === missingItems) totalPrice = 0;

      const coveragePercent = Math.round(((listItems.length - missingItems) / listItems.length) * 100);
      const travelCost = distance * 2 * 1.5;
      const realCost = totalPrice > 0 ? totalPrice + travelCost : 0;

      return {
        id: market.id,
        name: market.name,
        address: market.address,
        totalPrice,
        distance,
        missingItems,
        substitutedItems,
        totalItems: listItems.length,
        coveragePercent,
        realCost,
        isRecommended: false,
        lastUpdate,
        matches
      };
    });

    let finalResults = results;

    if (!targetMarketId) {
      finalResults = results.filter(m => m.totalPrice > 0 && m.coveragePercent > 0);

      finalResults.sort((a, b) => {
        if (a.missingItems !== b.missingItems) return a.missingItems - b.missingItems;
        return a.realCost - b.realCost;
      });

      if (finalResults.length > 0) finalResults[0].isRecommended = true;
    }

    return new Response(JSON.stringify({
      success: true,
      results: finalResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro Smart Compare:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});