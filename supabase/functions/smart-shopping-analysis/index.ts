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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { listId, userLocation, radius, targetMarketId } = await req.json();

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
      // Modo Detalhe: Analisa apenas um mercado específico (ignora raio)
      const { data: market, error: mError } = await supabase
        .from("markets")
        .select("*")
        .eq("id", targetMarketId)
        .single();
      if (mError) throw mError;
      marketsToAnalyze = [market];
    } else {
      // Modo Comparação Geral: Usa raio
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
        includeScore: true
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

        let match = null;
        let isSubstitution = false;
        let matchType = 'missing';

        // A. Match Exato
        const exactMatch = marketPrices.find(p => p.product_id === targetId);

        if (exactMatch) {
          match = exactMatch;
          matchType = 'exact';
        } else {
          // B. Match Inteligente
          const searchResult = marketProductsSearch.search(targetName);
          const candidates = searchResult
            .filter(res => res.score !== undefined && res.score < 0.4)
            .map(res => res.item);

          if (candidates.length > 0) {
            if (targetBrand) {
              const brandMatch = candidates.find(c =>
                c.products.brand?.toLowerCase().trim().includes(targetBrand)
              );
              if (brandMatch) {
                match = brandMatch;
                matchType = 'brand_variant';
              } else {
                candidates.sort((a, b) => a.price - b.price);
                match = candidates[0];
                isSubstitution = true;
                matchType = 'cheapest_sub';
              }
            } else {
              candidates.sort((a, b) => a.price - b.price);
              match = candidates[0];
              matchType = 'generic_best';
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

    // FILTRAGEM E ORDENAÇÃO (CORREÇÃO APLICADA AQUI)
    let finalResults = results;

    if (!targetMarketId) {
      // Remove mercados zerados ou sem itens na busca geral
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