import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketData {
  id: string;
  name: string;
  totalPrice: number;
  distance: number;
  missingItems: number;
  totalItems: number;
  products: Array<{ name: string; price: number | null; quantity: number }>;
}

interface AnalysisRequest {
  markets: MarketData[];
  userLocation: { lat: number; lng: number };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { markets, userLocation } = await req.json() as AnalysisRequest;

    console.log(`Analyzing ${markets.length} markets for smart shopping recommendations`);

    // Filter out markets with no prices (total = 0)
    const marketsWithPrices = markets.filter(m => m.totalPrice > 0);

    if (marketsWithPrices.length === 0) {
      return new Response(JSON.stringify({
        recommendation: {
          type: "no_data",
          message: "Nenhum mercado possui preços cadastrados para os itens da sua lista. Cadastre preços para obter recomendações inteligentes.",
          markets: [],
          analysis: null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context for AI analysis
    const marketsSummary = marketsWithPrices.map(m => ({
      name: m.name,
      distance_km: m.distance.toFixed(2),
      total_price: m.totalPrice.toFixed(2),
      items_available: m.totalItems - m.missingItems,
      items_missing: m.missingItems,
      total_items: m.totalItems,
      coverage_percent: Math.round(((m.totalItems - m.missingItems) / m.totalItems) * 100),
      products: m.products.map(p => ({
        name: p.name,
        price: p.price ? `R$ ${p.price.toFixed(2)}` : "sem preço",
        qty: p.quantity
      }))
    }));

    const systemPrompt = `Você é um assistente especializado em economia doméstica e compras inteligentes no Brasil. 
Sua função é analisar opções de mercados e recomendar a melhor estratégia de compras considerando:

1. CUSTO-BENEFÍCIO: Preço total vs distância vs itens disponíveis
2. DESLOCAMENTO: Considere que cada km de deslocamento custa aproximadamente R$ 1,50 (combustível + tempo)
3. COMPLETUDE: Mercados com todos os itens são preferíveis, mas splits podem valer a pena se a economia for significativa
4. PRATICIDADE: Ir em um só lugar geralmente é melhor, a menos que a economia seja > 15% do valor total

REGRAS DE DECISÃO:
- Se um mercado tem < 50% dos itens, só recomende se o preço for MUITO menor
- Calcule o custo real = preço dos produtos + (distância * 2 * R$ 1,50) para ida e volta
- Para splits entre mercados, some os custos de deslocamento para ambos
- Priorize mercados mais próximos em caso de empate de preços (diferença < 5%)

Responda SEMPRE em português brasileiro e seja direto e prático.`;

    const userPrompt = `Analise estas opções de mercados para uma lista de compras:

MERCADOS DISPONÍVEIS:
${JSON.stringify(marketsSummary, null, 2)}

TOTAL DE ITENS NA LISTA: ${marketsWithPrices[0]?.totalItems || 0}

Por favor, forneça:
1. RECOMENDAÇÃO PRINCIPAL: Qual a melhor opção? (pode ser um mercado só ou combinação)
2. JUSTIFICATIVA: Por que esta é a melhor escolha? (considere preço, distância, itens disponíveis)
3. ECONOMIA ESTIMADA: Quanto o usuário economiza comparado à pior opção?
4. ALERTAS: Avisos importantes (itens faltantes, mercados muito longe, etc.)

Seja conciso e prático. Foque no que realmente importa para o consumidor.`;

    console.log("Sending request to OpenAI...");

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiAnalysis = data.choices[0].message.content;

    console.log("AI analysis completed successfully");

    // Sort markets by real cost (price + travel cost)
    const marketsWithRealCost = marketsWithPrices.map(m => ({
      ...m,
      travelCost: m.distance * 2 * 1.5, // ida e volta
      realCost: m.totalPrice + (m.distance * 2 * 1.5),
      coveragePercent: Math.round(((m.totalItems - m.missingItems) / m.totalItems) * 100)
    }));

    // Filter markets with at least 30% coverage
    const viableMarkets = marketsWithRealCost
      .filter(m => m.coveragePercent >= 30)
      .sort((a, b) => {
        // Prioritize complete markets, then by real cost
        if (a.missingItems === 0 && b.missingItems > 0) return -1;
        if (b.missingItems === 0 && a.missingItems > 0) return 1;
        return a.realCost - b.realCost;
      });

    return new Response(JSON.stringify({
      recommendation: {
        type: "smart_analysis",
        message: aiAnalysis,
        markets: viableMarkets.slice(0, 5),
        bestOption: viableMarkets[0] || null,
        analysis: {
          totalMarketsAnalyzed: markets.length,
          marketsWithPrices: marketsWithPrices.length,
          viableMarkets: viableMarkets.length
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in smart-shopping-analysis:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendation: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
