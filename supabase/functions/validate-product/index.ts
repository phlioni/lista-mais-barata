import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
    // 1. Handle CORS preflight requests (Browser checks permission first)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 2. Validate request body
        const { name, brand } = await req.json()

        if (!name) {
            throw new Error('Nome do produto é obrigatório')
        }

        // 3. Call OpenAI API
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY não configurada no Supabase Secrets');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Você é um assistente especialista em cadastro de produtos de supermercado no Brasil.
            Sua função é corrigir erros ortográficos, padronizar a capitalização e validar se o produto faz sentido.
            
            Regras:
            1. Corrija erros de digitação (ex: "omate" -> "Tomate", "coca cola" -> "Coca-Cola").
            2. Padronize para o formato comum em mercados brasileiros (Primeira Letra Maiúscula).
            3. Se a marca for nula ou vazia, e o nome do produto contiver a marca (ex: "Sabão Omo"), separe-os.
            4. Se o produto não parecer um item de mercado ou for algo sem sentido, marque isValid como false.
            
            Retorne APENAS um JSON estrito com o formato:
            {
              "correctedName": string,
              "correctedBrand": string | null,
              "isValid": boolean,
              "reason": string (se isValid for false)
            }`
                    },
                    {
                        role: 'user',
                        content: `Analise este produto: Nome: "${name}", Marca: "${brand || ''}"`
                    }
                ],
                temperature: 0.3,
            }),
        })

        const data = await response.json()

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error("OpenAI Response Error:", data);
            throw new Error("Falha ao processar resposta da IA");
        }

        const aiContent = data.choices[0].message.content

        // Parse do JSON retornado pela IA (removendo possíveis code blocks markdown)
        const cleanJson = aiContent.replace(/```json/g, '').replace(/```/g, '').trim()
        const result = JSON.parse(cleanJson)

        // 4. Return successful response with CORS headers
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Error in validate-product:', error)

        // 5. Return error response WITH CORS headers (Crucial for frontend to see the error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})