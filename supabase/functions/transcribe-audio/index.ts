import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { audioBase64 } = await req.json();

        if (!audioBase64) {
            throw new Error('Áudio não fornecido');
        }

        // Converter Base64 para Blob/File
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const file = new File([bytes], "audio.webm", { type: "audio/webm" });

        // Preparar FormData para OpenAI
        const formData = new FormData();
        formData.append("file", file);
        formData.append("model", "whisper-1");
        formData.append("language", "pt"); // Forçar português melhora a precisão de marcas locais

        const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

        // Chamar API Whisper
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openAIApiKey}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenAI Error:", errorText);
            throw new Error(`Erro na transcrição: ${response.status}`);
        }

        const data = await response.json();

        return new Response(JSON.stringify({ text: data.text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Erro:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});