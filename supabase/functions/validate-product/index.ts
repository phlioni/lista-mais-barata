import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { name, brand } = await req.json();

        if (!name) {
            throw new Error('Nome do produto é obrigatório');
        }

        // Prompt Refinado para "Traduzir" Cupom Fiscal Brasileiro
        const systemPrompt = `
      Você é um especialista em decifrar itens de cupom fiscal brasileiro (NFC-e).
      Sua missão é expandir abreviações, corrigir nomes e separar metadados.

      ENTRADA: Nome: "${name}", Marca Sugerida: "${brand || ''}"

      DIRETRIZES DE TRADUÇÃO (IMPORTANTE):
      1. EXPANDA ABREVIAÇÕES COMUNS:
         - "M TOM", "M. TOM", "MASSA TOM" -> Nome: "Massa de Tomate"
         - "MOLHO TOM", "MOL TOM" -> Nome: "Molho de Tomate"
         - "EXT TOM" -> Nome: "Extrato de Tomate"
         - "LAV R", "LAVA ROUP" -> Nome: "Lava Roupas"
         - "SAB PO", "SAB PO" -> Nome: "Sabão em Pó"
         - "SAB BARRA" -> Nome: "Sabão em Barra"
         - "PAP HIG", "P. HIG" -> Nome: "Papel Higiênico"
         - "CR LEITE" -> Nome: "Creme de Leite"
         - "LEITE COND" -> Nome: "Leite Condensado"
         - "ACHOC" -> Nome: "Achocolatado"
         - "REFRIG", "REF" -> Nome: "Refrigerante"
         - "BATATA PAL" -> Nome: "Batata Palha"
         - "MAC", "ESPAG", "PARAF" -> Nome: "Macarrão" (Espaguete, Parafuso)

      2. SEPARAÇÃO INTELIGENTE:
         - O "Nome" deve ser o TIPO do produto (ex: "Massa de Tomate").
         - A "Marca" deve ser extraída do texto se não fornecida (ex: em "M TOM MAMMA", "MAMMA" é a Marca).
         - A "Medida" deve ser extraída se houver (ex: "340g", "1kg", "2L").

      3. REGRAS GERAIS:
         - Use Title Case (Iniciais Maiúsculas).
         - Se a marca for óbvia (ex: Coca-Cola, Yoki, Mamma), preencha o campo brand.
         - Se o nome ficar genérico demais (ex: "Alimento"), tente ser mais específico com base nas palavras chaves.

      SAÍDA ESPERADA (JSON):
      {
        "isValid": boolean,
        "correctedName": "string (Nome expandido e corrigido)",
        "correctedBrand": "string | null",
        "detectedMeasurement": "string | null (ex: '340g')",
        "reason": "string (apenas se inválido)"
      }
    `;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Modelo rápido e eficiente para essa tarefa
                messages: [
                    { role: 'system', content: systemPrompt }
                ],
                temperature: 0.1, // Baixa temperatura para ser mais assertivo e menos "criativo"
                response_format: { type: "json_object" }
            }),
        });

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});