import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Fuse from "https://esm.sh/fuse.js@6.6.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para calcular distância (Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

    const { listId, userLocation, radius } = await req.json();

    if (!listId || !userLocation) throw new Error("Dados incompletos");

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

    // 2. Buscar Mercados no Raio
    const { data: allMarkets, error: marketsError } = await supabase
      .from("markets")
      .select("*");

    if (marketsError) throw marketsError;

    const marketsInRadius = allMarkets.filter(m => {
      const dist = calculateDistance(userLocation.lat, userLocation.lng, m.latitude, m.longitude);
      return dist <= radius;
    });

    if (marketsInRadius.length === 0) {
      return new Response(JSON.stringify({ success: true, results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const marketIds = marketsInRadius.map(m => m.id);

    // 3. Buscar PREÇOS (Fonte da Verdade)
    const { data: allPrices, error: pricesError } = await supabase
      .from("market_prices")
      .select(`
        price, market_id, product_id, created_at,
        products (id, name, brand, measurement)
      `)
      .in("market_id", marketIds);

    if (pricesError) throw pricesError;

    // 4. Cruzamento Inteligente com Travas de Segurança
    const results = marketsInRadius.map(market => {
      const distance = calculateDistance(userLocation.lat, userLocation.lng, market.latitude, market.longitude);

      // Filtra APENAS preços deste mercado
      const marketPrices = allPrices.filter(p => p.market_id === market.id);

      // Configura Fuzzy Search mais restrito (0.2 = bem exigente)
      const marketProductsSearch = new Fuse(marketPrices, {
        keys: ["products.name"], // Busca foca no nome
        threshold: 0.2, // Reduzido de 0.4 para 0.2 para evitar falsos positivos
        includeScore: true
      });

      let totalPrice = 0;
      let missingItems = 0;
      let foundPriceDates: string[] = [];

      listItems.forEach(item => {
        const targetId = item.products.id;
        const targetName = item.products.name;
        const targetBrand = item.products.brand?.toLowerCase().trim();

        // A. Tentativa Exata (Pelo ID do produto) - Prioridade Máxima
        let match = marketPrices.find(p => p.product_id === targetId);

        // B. Tentativa Inteligente (Se não achou exato)
        if (!match) {
          const searchResult = marketProductsSearch.search(targetName);

          if (searchResult.length > 0) {
            const bestMatch = searchResult[0];
            const candidate = bestMatch.item.products;
            const candidateBrand = candidate.brand?.toLowerCase().trim();

            // TRAVA DE SEGURANÇA DE MARCA
            // Se ambos tem marca definida e elas são diferentes, REJEITA.
            // (Evita que Leite Parmalat dê match com Leite Ninho)
            let brandMismatch = false;
            if (targetBrand && candidateBrand) {
              // Verifica se as marcas são diferentes (tolerando substring ex: "Coca" e "Coca-Cola")
              if (!candidateBrand.includes(targetBrand) && !targetBrand.includes(candidateBrand)) {
                brandMismatch = true;
              }
            }

            // Se a marca bater (ou um deles não tiver marca) E a medida bater (opcional), aceita
            if (!brandMismatch) {
              match = bestMatch.item;
            }
          }
        }

        if (match) {
          totalPrice += match.price * item.quantity;
          foundPriceDates.push(match.created_at);
        } else {
          missingItems++;
        }
      });

      let lastUpdate = new Date().toISOString();
      if (foundPriceDates.length > 0) {
        foundPriceDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        lastUpdate = foundPriceDates[0];
      }

      // Se o mercado não tem nenhum item da lista, ignoramos o preço total
      if (listItems.length === missingItems) {
        totalPrice = 0;
      }

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
        totalItems: listItems.length,
        coveragePercent,
        realCost,
        isRecommended: false,
        lastUpdate
      };
    });

    // Ordenação e Recomendação
    const viableMarkets = results
      .filter(m => m.totalPrice > 0 && m.coveragePercent > 0) // Só mostra se tiver pelo menos 1 item
      .sort((a, b) => {
        // Prioriza quem tem mais itens (menos faltantes)
        if (a.missingItems !== b.missingItems) return a.missingItems - b.missingItems;
        // Depois quem é mais barato (custo real)
        return a.realCost - b.realCost;
      });

    if (viableMarkets.length > 0) {
      viableMarkets[0].isRecommended = true;
    }

    return new Response(JSON.stringify({
      success: true,
      results: viableMarkets
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