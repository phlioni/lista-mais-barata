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

        // PROMPT REFINADO: Foca em nomes no SINGULAR e GENÉRICOS para facilitar o match no banco
        const systemPrompt = `Você é um assistente especialista em organizar listas de compras.
Sua tarefa é converter texto desestruturado em JSON limpo.

REGRAS CRÍTICAS DE NOMECLATURA:
1. Use SEMPRE o SINGULAR (Ex: "Limões" -> "Limão", "Arrozes" -> "Arroz").
2. Remova adjetivos de quantidade ou embalagem do nome (Ex: "Pacote de Arroz" -> "Arroz", "Garrafa de óleo" -> "Óleo").
3. Mantenha marca se especificada, mas prefira nomes curtos.

CATEGORIAS PERMITIDAS:
"Hortifruti", "Açougue", "Padaria", "Laticínios", "Mercearia", "Bebidas", "Limpeza", "Higiene", "Outros".

Exemplo Entrada: "traz 2 leites, uns pães e 1kg de contra file"
Exemplo Saída:
{
  "items": [
    { "name": "Leite", "quantity": 2, "category": "Laticínios" },
    { "name": "Pão Francês", "quantity": 5, "category": "Padaria" },
    { "name": "Contra Filé", "quantity": 1, "category": "Açougue" }
  ]
}`;

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