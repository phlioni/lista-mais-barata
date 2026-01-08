import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { name, brand } = await req.json();

        if (!name) {
            throw new Error('Nome do produto é obrigatório');
        }

        // Prompt para a IA normalizar imediatamente
        const systemPrompt = `
      Você é um validador de dados de supermercado.
      Sua função é corrigir ortografia e separar Marca de Produto.

      ENTRADA: Nome: "${name}", Marca Sugerida: "${brand || ''}"

      REGRAS:
      1. Se o nome contiver a marca (ex: "MACA FUJI"), separe: Nome="Macarrão", Marca="Fuji".
      2. Corrija abreviações (ex: "MACA" -> "Macarrão", "LEIT" -> "Leite", "SAB" -> "Sabão").
      3. Use Title Case (iniciais maiúsculas).
      4. Se o produto parecer inválido/nonsense, marque isValid: false.

      SAÍDA (JSON):
      {
        "isValid": boolean,
        "correctedName": "string",
        "correctedBrand": "string | null",
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
                model: 'gpt-4o-mini', // Rápido e barato para rodar em tempo real
                messages: [
                    { role: 'system', content: systemPrompt }
                ],
                temperature: 0.1,
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