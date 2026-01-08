import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { url } = await req.json();

        if (!url) {
            throw new Error('URL is required');
        }

        console.log(`Fetching NFC-e: ${url}`);

        // Tratamento de URL com pipes
        const safeUrl = url.includes('|') ? encodeURI(url) : url;

        const response = await fetch(safeUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const items: any[] = [];

        // --- Estratégia de Scraping Atualizada ---

        // Padrão SEFAZ (tabela com ID tabResult ou linhas tr genéricas)
        $('tr').each((i, el) => {
            const $el = $(el);

            // 1. Nome do Produto (busca nas classes comuns)
            const name = $el.find('.txtTit, .txtTit2, h4, .truncate').first().text().trim();

            // 2. Código (se houver)
            const code = $el.find('.RCod').text().replace('(Código:', '').replace(')', '').trim();

            // 3. Quantidade
            // Geralmente aparece como "Qtde.: 2"
            const qtdText = $el.find('.Rqtd').text().replace('Qtde.:', '').trim();
            const quantity = parseFloat(qtdText.replace(',', '.')) || 1;

            // 4. Unidade Comercial (UN, KG, CX)
            const unit = $el.find('.RUN').text().replace('UN:', '').trim();

            // 5. Valor Total do Item
            const valTotalText = $el.find('.Valor').text().trim();
            const totalPrice = parseFloat(valTotalText.replace(/[^0-9,]/g, '').replace(',', '.'));

            // 6. Valor Unitário (O PULO DO GATO)
            // Procura especificamente o campo "Vl. Unit."
            let unitPrice = 0;
            const valUnitText = $el.find('.RvlUnit').text().replace('Vl. Unit.:', '').trim();

            if (valUnitText) {
                unitPrice = parseFloat(valUnitText.replace(/[^0-9,]/g, '').replace(',', '.'));
            } else {
                // Fallback: Se não achar o campo unitário explícito, calcula
                unitPrice = quantity > 0 ? (totalPrice / quantity) : totalPrice;
            }

            if (name && !isNaN(totalPrice)) {
                items.push({
                    name: name, // Mandamos o nome BRUTO (Ex: BATATA PALHA YOKI 500G) para a IA tratar depois
                    quantity: quantity,
                    unit: unit,
                    total_price: totalPrice,
                    unit_price: unitPrice, // Agora temos o preço unitário exato da nota
                    code: code
                });
            }
        });

        // Fallback para layouts antigos (tabela simples)
        if (items.length === 0) {
            $('table#tabResult tr').each((i, el) => {
                const tds = $(el).find('td');
                if (tds.length >= 2) {
                    const name = $(tds[0]).text().trim();
                    const val = $(tds[1]).text().trim(); // Valor Total

                    // Tenta achar unitário em colunas extras se existirem, senão calcula
                    if (name && val && val.includes(',')) {
                        const price = parseFloat(val.replace('.', '').replace(',', '.'));
                        if (!isNaN(price)) {
                            items.push({
                                name,
                                total_price: price,
                                quantity: 1,
                                unit_price: price // Assume 1 se não achar qtde
                            });
                        }
                    }
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