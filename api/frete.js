export default async function handler(req, res) {
    // Libera CORS para chamadas vindas do seu GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { cepDestino, itens } = req.body;
        const cleanCep = (cepDestino || '').replace(/\D/g, '');
        if (cleanCep.length !== 8) {
            return res.status(400).json({ error: 'CEP de destino inválido.' });
        }

        // Calcula peso total e dimensões consolidadas do pacote
        let totalWeight = 0;
        let maxWidth = 12;
        let maxLength = 16;
        let totalHeight = 0;

        (itens || []).forEach(item => {
            const qtd = Number(item.qtd || 1);
            totalWeight += Number(item.peso || 0.15) * qtd;
            maxWidth = Math.max(maxWidth, Number(item.largura || 12));
            maxLength = Math.max(maxLength, Number(item.comprimento || 16));
            totalHeight += Number(item.altura || 3) * qtd;
        });

        // Garante limites mínimos exigidos pelos Correios/SuperFrete
        totalWeight = Math.max(0.1, Number(totalWeight.toFixed(2)));
        totalHeight = Math.max(2, Math.min(totalHeight, 100));

        const baseUrl = process.env.SUPERFRETE_SANDBOX === 'true'
            ? 'https://sandbox.superfrete.com'
            : 'https://api.superfrete.com';

        const response = await fetch(`${baseUrl}/api/v0/calculator`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SUPERFRETE_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'ArmieMania/1.0 (contato@armiemania.com.br)'
            },
            body: JSON.stringify({
                from: { postal_code: (process.env.CEP_ORIGEM || '59000000').replace(/\D/g, '') },
                to: { postal_code: cleanCep },
                services: "1,2,17", // 1 = PAC, 2 = SEDEX, 17 = Mini Envios
                package: {
                    weight: totalWeight,
                    width: maxWidth,
                    height: totalHeight,
                    length: maxLength
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ error: data.message || 'Erro ao cotar no SuperFrete', details: data });
        }

        // Filtra apenas opções válidas sem erro
        const opcoes = (Array.isArray(data) ? data : [])
            .filter(s => !s.error && s.price)
            .map(s => ({
                id: s.id,
                nome: s.name,
                empresa: s.company?.name || 'Correios',
                valor: Number(s.price),
                prazo: s.delivery_time
            }));

        return res.status(200).json({ opcoes });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}