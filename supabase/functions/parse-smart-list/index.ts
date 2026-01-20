import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
        const { text } = await req.json();

        if (!text) throw new Error('Texto não fornecido');

        // PROMPT ATUALIZADO:
        // Prioriza a criação de itens GENÉRICOS e SIMPLES para facilitar o match de "Menor Preço".
        // Instrução explícita para ignorar marcas a menos que muito específicas, e ignorar quantidades no nome.
        const systemPrompt = `Você é um assistente especialista em organizar listas de compras simples e rápidas.
Sua tarefa é converter texto falado ou digitado em uma lista JSON limpa de produtos.

OBJETIVO:
O usuário quer adicionar itens rapidamente (ex: "Arroz, Feijão, Batata").
Você deve retornar apenas o NOME BASE do produto, no singular.

REGRAS DE OURO:
1. NOME GENÉRICO: Se o usuário disser "Arroz Tio João", prefira retornar "Arroz" se não for crucial. Se ele disser apenas "Arroz", retorne "Arroz". O objetivo é encontrar o mais barato depois.
2. SINGULAR SEMPRE: "Limões" -> "Limão". "Pães" -> "Pão Francês" (se for o caso) ou "Pão".
3. SEM QUANTIDADES NO NOME: "2kg de carne" -> nome: "Carne", quantity: 1 (padrão). A quantidade será ajustada depois pelo usuário se necessário, mas foque em identificar o PRODUTO.
4. CATEGORIZAÇÃO: Tente categorizar corretamente.

Exemplo Entrada: "preciso de arroz, 2 leites e batata doce"
Exemplo Saída:
{
  "items": [
    { "name": "Arroz", "category": "Mercearia" },
    { "name": "Leite", "category": "Laticínios" },
    { "name": "Batata Doce", "category": "Hortifruti" }
  ]
}

Se a entrada for confusa, tente extrair o máximo de itens possível.`;

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
                    { role: 'user', content: text }
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
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});