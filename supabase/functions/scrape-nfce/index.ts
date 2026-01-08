import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { url } = await req.json();

        if (!url) {
            throw new Error('URL is required');
        }

        console.log(`Fetching NFC-e: ${url}`);

        // Simulamos um User-Agent de iPhone para garantir que o site da Fazenda retorne
        // a versão mobile simplificada (que é mais fácil de ler e tem menos bloqueios)
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const items: any[] = [];

        // Lógica de Extração (Scraping)
        // Tenta encontrar linhas de tabela. O layout padrão da NFC-e costuma usar <tr> com classes específicas.
        // Adaptado para layouts comuns da SEFAZ (SP, RJ, etc.)

        $('tr').each((i, el) => {
            // 1. Nome do Produto (Geralmente na classe .txtTit ou .txtTit2)
            const name = $(el).find('.txtTit, .txtTit2').first().text().trim();

            // 2. Código do Produto (Geralmente na classe .RCod)
            const code = $(el).find('.RCod').text().replace('(Código:', '').replace(')', '').trim();

            // 3. Quantidade (Geralmente na classe .Rqtd)
            const qtdText = $(el).find('.Rqtd').text().replace('Qtde.:', '').trim();
            const quantity = parseFloat(qtdText.replace(',', '.')) || 1;

            // 4. Unidade (UN, KG, etc)
            const unit = $(el).find('.RUN').text().replace('UN:', '').trim();

            // 5. Valor Total do Item (Geralmente na classe .Valor)
            const valText = $(el).find('.Valor').text().trim();
            // Remove "R$" e espaços, converte vírgula para ponto
            const totalPrice = parseFloat(valText.replace(/[^0-9,]/g, '').replace(',', '.'));

            // Validamos se encontrou pelo menos nome e preço
            if (name && !isNaN(totalPrice)) {
                // Cálculo do unitário se não estiver explícito na linha
                const unitPrice = quantity > 0 ? (totalPrice / quantity) : totalPrice;

                items.push({
                    name: name,
                    quantity: quantity,
                    unit: unit,
                    total_price: totalPrice, // Valor total pago pelo item (importante para o app)
                    unit_price: unitPrice,
                    code: code
                });
            }
        });

        // Fallback: Se a lógica acima não encontrar nada, tenta um seletor mais genérico
        // para tabelas antigas (id="tabResult")
        if (items.length === 0) {
            $('table#tabResult tr').each((i, el) => {
                const tds = $(el).find('td');
                // Assume estrutura: Nome | ... | Valor
                const name = $(tds[0]).find('span.txtTit').text().trim();
                const val = $(tds[1]).find('span.valor').text().trim();

                if (name && val) {
                    const price = parseFloat(val.replace(',', '.')) || 0;
                    items.push({
                        name,
                        total_price: price,
                        quantity: 1,
                        unit_price: price
                    });
                }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            items: items,
            count: items.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error processing NFC-e:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});