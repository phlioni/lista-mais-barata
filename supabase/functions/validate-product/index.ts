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

        if (!name) throw new Error('Nome do produto é obrigatório');

        const systemPrompt = `
      Você é um especialista em produtos de supermercado.
      Sua tarefa é normalizar o nome do produto e EXTRAIR metadados.

      ENTRADA: Nome: "${name}", Marca Sugerida: "${brand || ''}"

      REGRAS:
      1. Extraia o NOME PRINCIPAL (ex: "Batata Palha", "Coca-Cola").
      2. Extraia a MARCA se estiver no nome (ex: "Yoki", "Nestlé").
      3. Extraia a MEDIDA/PESO se houver (ex: "500g", "1kg", "2L", "350ml", "Unitario").
         - Se não houver medida explícita, retorne null.
      4. Corrija ortografia e use Title Case.

      SAÍDA (JSON):
      {
        "isValid": boolean,
        "correctedName": "string (apenas o nome do produto)",
        "correctedBrand": "string | null",
        "detectedMeasurement": "string | null (ex: '500g')",
        "reason": "string (se inválido)"
      }
    `;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
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