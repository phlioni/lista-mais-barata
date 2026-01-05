import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScanRequest {
    imageBase64: string;
    currentItems: Array<{
        id: string;
        name: string;
        brand: string | null;
    }>;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { imageBase64, currentItems } = await req.json() as ScanRequest;

        if (!imageBase64) {
            throw new Error('Nenhuma imagem fornecida');
        }

        console.log(`Processando nota fiscal com ${currentItems.length} itens de contexto...`);

        // Prompt do Sistema OTIMIZADO para evitar erros de preço unitário vs total
        const systemPrompt = `Você é um assistente especialista em ler notas fiscais (cupom fiscal) de supermercados brasileiros.
Sua tarefa é extrair os produtos e preços da imagem e cruzá-los com uma lista de compras esperada.

ENTRADA:
1. Uma imagem de nota fiscal.
2. Uma lista de itens esperados (JSON).

SAÍDA ESPERADA (JSON ESTRITO):
{
  "matched": [
    { "list_item_id": "ID_DA_LISTA", "receipt_name": "NOME_NA_NOTA", "price": 10.50, "confidence": "high/medium/low" }
  ],
  "new_items": [
    { "name": "NOME_DO_PRODUTO", "price": 10.50, "quantity": 1 }
  ],
  "review_needed": [
    { "list_item_id": "ID_DA_LISTA", "receipt_name": "NOME_NA_NOTA", "reason": "Marca diferente ou nome ambíguo", "price": 10.50 }
  ]
}

REGRAS CRÍTICAS DE PREÇO (LEIA COM ATENÇÃO):
1. **PREÇO POR KG vs PREÇO FINAL:** Em itens de peso (pão, carne, frutas), a nota mostra "Qtde x Vl.Unit" e depois o "Vl.Total".
   - EXEMPLO: "0,450 kg x R$ 19,90 (kg) ... R$ 8,95".
   - VOCÊ DEVE PEGAR O VALOR FINAL PAGO (R$ 8,95). **NUNCA** pegue o preço do quilo (R$ 19,90).
2. O preço deve ser o valor unitário *pago* pelo item na quantidade comprada, ou o valor total da linha se for quantidade 1.
3. Ignore símbolos de moeda (R$). Retorne apenas números float (ex: 4.59).

REGRAS DE MATCHING:
1. Se o nome na nota for uma abreviação óbvia do item da lista (ex: "CAF PILAO" == "Café Pilão"), coloque em "matched".
2. Se o produto for o mesmo mas a marca diferente, coloque em "review_needed".
3. Se o item da nota não existir na lista, coloque em "new_items".
`;

        const userPrompt = `Aqui está a lista de itens que eu planejei comprar (use estes IDs para o retorno):
${JSON.stringify(currentItems, null, 2)}

Analise a imagem da nota fiscal e gere o JSON de conciliação, prestando muita atenção para não confundir preço unitário (kg) com preço total.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: "text", text: userPrompt },
                            { type: "image_url", image_url: { url: imageBase64 } }
                        ]
                    }
                ],
                max_tokens: 2000,
                temperature: 0.1,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', response.status, errorText);
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in scan-receipt:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});