import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    // Validação de segurança do Webhook do Asaas
    const tokenRecebido = req.headers['asaas-access-token'];
    if (process.env.ASAAS_WEBHOOK_TOKEN && tokenRecebido !== process.env.ASAAS_WEBHOOK_TOKEN) {
        return res.status(401).json({ error: 'Token de webhook inválido' });
    }

    try {
        const { event, payment } = req.body;

        // Só processa quando o pagamento for confirmado ou recebido
        if (event !== 'PAYMENT_CONFIRMED' && event !== 'PAYMENT_RECEIVED') {
            return res.status(200).json({ received: true, ignored: event });
        }

        const pedidoId = payment?.externalReference;
        if (!pedidoId) {
            return res.status(200).json({ received: true, warning: 'Sem externalReference' });
        }

        const pedidoRef = db.collection('pedidos').doc(pedidoId);
        const pedidoSnap = await pedidoRef.get();
        if (!pedidoSnap.exists) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        const pedido = pedidoSnap.data();

        // Evita duplicidade caso o Asaas reenvie o mesmo webhook
        if (pedido.estoqueBaixado) {
            return res.status(200).json({ received: true, alreadyProcessed: true });
        }

        // 1. BAIXA AUTOMÁTICA NO ESTOQUE ONLINE (Firestore)
        const batch = db.batch();
        for (const item of (pedido.itens || [])) {
            if (item.id && !item.id.startsWith('demo')) {
                const prodRef = db.collection('produtos').doc(item.id);
                batch.update(prodRef, {
                    estoque: admin.firestore.FieldValue.increment(-Number(item.qtd || 1))
                });
            }
        }
        await batch.commit();

        // 2. CADASTRO AUTOMÁTICO DE ENVIO E ETIQUETA NO SUPERFRETE
        const sfUrl = process.env.SUPERFRETE_SANDBOX === 'true'
            ? 'https://sandbox.superfrete.com'
            : 'https://api.superfrete.com';

        const sfHeaders = {
            'Authorization': `Bearer ${process.env.SUPERFRETE_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'ArmieMania/1.0 (contato@armiemania.com.br)'
        };

        let totalWeight = 0;
        let maxWidth = 12;
        let maxLength = 16;
        let totalHeight = 0;

        (pedido.itens || []).forEach(i => {
            const qtd = Number(i.qtd || 1);
            totalWeight += Number(i.peso || 0.15) * qtd;
            maxWidth = Math.max(maxWidth, Number(i.largura || 12));
            maxLength = Math.max(maxLength, Number(i.comprimento || 16));
            totalHeight += Number(i.altura || 3) * qtd;
        });

        // Adiciona envio ao carrinho do SuperFrete
        const cartRes = await fetch(`${sfUrl}/api/v0/cart`, {
            method: 'POST',
            headers: sfHeaders,
            body: JSON.stringify({
                service: Number(pedido.freteServicoId || 1),
                from: {
                    name: process.env.REMETENTE_NOME || 'ArmieMania Loja',
                    phone: (process.env.REMETENTE_TELEFONE || '').replace(/\D/g, ''),
                    email: process.env.REMETENTE_EMAIL || '',
                    document: (process.env.REMETENTE_CPF_CNPJ || '').replace(/\D/g, ''),
                    address: process.env.REMETENTE_RUA || '',
                    number: process.env.REMETENTE_NUMERO || 'S/N',
                    district: process.env.REMETENTE_BAIRRO || '',
                    city: process.env.REMETENTE_CIDADE || 'Natal',
                    state_abbr: process.env.REMETENTE_UF || 'RN',
                    postal_code: (process.env.CEP_ORIGEM || '').replace(/\D/g, '')
                },
                to: {
                    name: pedido.clienteNome,
                    phone: (pedido.clienteWhatsapp || '').replace(/\D/g, ''),
                    email: pedido.clienteEmail,
                    document: (pedido.clienteCpf || '').replace(/\D/g, ''),
                    address: pedido.endereco?.rua,
                    number: pedido.endereco?.numero,
                    complement: pedido.endereco?.complemento || '',
                    district: pedido.endereco?.bairro,
                    city: pedido.endereco?.cidade,
                    state_abbr: pedido.endereco?.estado,
                    postal_code: (pedido.endereco?.cep || '').replace(/\D/g, '')
                },
                products: (pedido.itens || []).map(i => ({
                    name: i.nome,
                    quantity: Number(i.qtd || 1),
                    unitary_value: Number(i.preco || 10)
                })),
                volumes: [{
                    weight: Math.max(0.1, Number(totalWeight.toFixed(2))),
                    width: maxWidth,
                    height: Math.max(2, totalHeight),
                    length: maxLength
                }],
                options: {
                    non_commercial: true
                }
            })
        });

        const sfOrder = await cartRes.json();
        let codigoRastreio = '';
        let etiquetaUrl = '';

        // Faz o checkout da etiqueta usando saldo SuperFrete e gera o link de impressão
        if (cartRes.ok && sfOrder.id) {
            await fetch(`${sfUrl}/api/v0/checkout`, {
                method: 'POST',
                headers: sfHeaders,
                body: JSON.stringify({ orders: [sfOrder.id] })
            });

            const printRes = await fetch(`${sfUrl}/api/v0/tag/print`, {
                method: 'POST',
                headers: sfHeaders,
                body: JSON.stringify({ orders: [sfOrder.id] })
            });
            const printData = await printRes.json();

            codigoRastreio = sfOrder.tracking || sfOrder.protocol || '';
            etiquetaUrl = printData.url || '';
        }

        // 3. ATUALIZA O PEDIDO NO FIRESTORE PARA O CLIENTE E O GESTOR
        await pedidoRef.update({
            status: 'Pago / Em Preparação',
            estoqueBaixado: true,
            superfreteOrderId: sfOrder.id || '',
            codigoRastreio,
            etiquetaUrl,
            pagoEm: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({ success: true, codigoRastreio });
    } catch (error) {
        console.error('Erro Webhook Asaas:', error);
        return res.status(500).json({ error: error.message });
    }
}
