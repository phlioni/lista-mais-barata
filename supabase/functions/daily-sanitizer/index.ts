import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
        // 1. Inicializar Cliente (Service Role para poder ler/escrever tudo)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Buscar lote de produtos "sujos" ou antigos (Ex: 20 por vez para economizar token)
        // Prioriza os que nunca foram sanitizados (sanitized_at IS NULL)
        const { data: products, error: fetchError } = await supabase
            .from('products')
            .select('id, name, brand, measurement')
            .order('sanitized_at', { ascending: true, nullsFirst: true })
            .limit(20);

        if (fetchError) throw fetchError;
        if (!products || products.length === 0) {
            return new Response(JSON.stringify({ message: "Nenhum produto para sanitizar." }), { headers: corsHeaders });
        }

        console.log(`Sanitizando ${products.length} produtos...`);

        // 3. Prompt para IA
        const prompt = `Você é um Auditor de Banco de Dados de Supermercado.
Sua tarefa é limpar a tabela de produtos.
Analise a lista JSON abaixo e decida a ação para cada item.

REGRAS:
1. Normalize nomes: "Abrobrinha" -> "Abobrinha". Use Singular.
2. Separe medida: Se o nome for "Coca Cola 2L", Nome="Coca Cola", Measurement="2L".
3. Identifique SPAM: Se for teste ("asdf", "teste123") ou não for comida/mercado, ação = "DELETE".
4. Mantenha marcas se existirem.

Retorne APENAS um JSON com array de objetos:
{
  "id": "uuid original",
  "action": "UPDATE" | "DELETE" | "KEEP",
  "name": "nome corrigido",
  "brand": "marca (se tiver)",
  "measurement": "medida (se tiver)"
}

Lista de Produtos:
${JSON.stringify(products)}
`;

        // 4. Chamar OpenAI
        const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            }),
        });

        const aiJson = await openAIRes.json();
        const cleanData = JSON.parse(aiJson.choices[0].message.content);

        // O GPT as vezes retorna { "products": [...] } ou apenas [...]. Tratamento:
        const payload = Array.isArray(cleanData) ? cleanData : (cleanData.products || cleanData.items);

        if (!payload) throw new Error("IA não retornou um formato válido.");

        // 5. Enviar para o Banco processar
        const { error: rpcError } = await supabase.rpc('process_sanitization_batch', {
            payload: payload
        });

        if (rpcError) throw rpcError;

        return new Response(JSON.stringify({ success: true, processed: payload.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});