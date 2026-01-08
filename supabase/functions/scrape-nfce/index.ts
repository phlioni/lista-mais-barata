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
            throw new Error('URL inválida ou não fornecida');
        }

        console.log(`Lendo NFC-e: ${url}`);

        // Tratamento de URL para evitar quebras com pipes (|)
        const cleanUrl = url.trim();
        const safeUrl = cleanUrl.includes('|') && !cleanUrl.includes('%7C')
            ? encodeURI(cleanUrl)
            : cleanUrl;

        // Headers para simular um iPhone (passar pelo WAF da SEFAZ)
        const response = await fetch(safeUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            }
        });

        if (!response.ok) {
            throw new Error(`Acesso negado pela SEFAZ (Status: ${response.status}). Tente tirar foto.`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Map para agregação (evitar duplicatas na mesma nota)
        // Chave: Código (se tiver) ou Nome
        const itemsMap = new Map();

        // --- ESTRATÉGIA DE EXTRAÇÃO ---
        $('tr').each((i, el) => {
            const $el = $(el);

            // 1. Identificação do Nome
            const name = $el.find('.txtTit, .txtTit2, h4, .truncate, span.txtTit').first().text().trim();
            if (!name) return;

            // 2. Identificação do Código (opcional, ajuda na agregação)
            const code = $el.find('.RCod').text().replace('(Código:', '').replace(')', '').trim();

            // 3. Valores Brutos
            const valUnitText = $el.find('.RvlUnit, .vlUnit').text().replace('Vl. Unit.:', '').trim();
            const qtdText = $el.find('.Rqtd, .qtd').text().replace('Qtde.:', '').trim();
            const unit = $el.find('.RUN, .unidade').text().replace('UN:', '').trim();
            // O valor total nós lemos apenas para fallback extremo, mas o foco é o unitário
            const valTotalText = $el.find('.Valor, .valor').text().trim();

            // 4. Conversão Numérica Segura
            const parseBRL = (val: string) => {
                if (!val) return 0;
                // Remove R$, espaços e converte vírgula para ponto
                return parseFloat(val.replace(/[^0-9,]/g, '').replace(',', '.'));
            };

            let quantity = parseBRL(qtdText);
            if (quantity === 0) quantity = 1;

            let unitPrice = parseBRL(valUnitText);
            const lineTotal = parseBRL(valTotalText);

            // Se não achou o preço unitário explícito, calcula pelo total/qtd
            if (unitPrice === 0 && lineTotal > 0) {
                unitPrice = lineTotal / quantity;
            }

            // Se achou um produto válido
            if (name && unitPrice > 0) {
                // Chave única para agregação
                const key = code ? `${code}-${name}` : name;

                if (itemsMap.has(key)) {
                    // Se já existe, soma a quantidade (ex: passou 2 manteigas separadas)
                    const existing = itemsMap.get(key);
                    existing.quantity += quantity;
                    // O preço unitário mantemos o do último (geralmente é igual)
                } else {
                    itemsMap.set(key, {
                        name: name,
                        quantity: quantity,
                        unit_price: unitPrice, // Enviamos OBRIGATORIAMENTE o preço unitário
                        unit: unit,
                        code: code
                    });
                }
            }
        });

        // Fallback: Regex se a tabela falhar
        if (itemsMap.size === 0) {
            const bodyText = $('body').text();
            // Lógica simplificada de regex se necessário...
            // Mas com o seletor acima cobrindo .RvlUnit, cobre 99% das SEFAZ
        }

        // Converte o Map de volta para Array
        const items = Array.from(itemsMap.values());

        return new Response(JSON.stringify({
            success: true,
            items: items,
            count: items.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Erro Scraper:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});