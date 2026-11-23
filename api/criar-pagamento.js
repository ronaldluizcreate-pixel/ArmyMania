import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { pedidoId } = req.body;
        if (!pedidoId) return res.status(400).json({ error: 'pedidoId obrigatório' });

        const pedidoRef = db.collection('pedidos').doc(pedidoId);
        const pedidoSnap = await pedidoRef.get();
        if (!pedidoSnap.exists) return res.status(404).json({ error: 'Pedido não encontrado' });

        const pedido = pedidoSnap.data();
        const asaasUrl = process.env.ASAAS_SANDBOX === 'true'
            ? 'https://sandbox.asaas.com/api/v3'
            : 'https://api.asaas.com/v3';

        const headers = {
            'access_token': process.env.ASAAS_API_KEY,
            'Content-Type': 'application/json'
        };

        // 1. Busca ou cria o cliente no Asaas usando o CPF
        const cleanCpf = (pedido.clienteCpf || '').replace(/\D/g, '');
        const searchRes = await fetch(`${asaasUrl}/customers?cpfCnpj=${cleanCpf}`, { headers });
        const searchData = await searchRes.json();

        let customerId;
        if (searchData.data && searchData.data.length > 0) {
            customerId = searchData.data[0].id;
        } else {
            const createCustRes = await fetch(`${asaasUrl}/customers`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: pedido.clienteNome,
                    email: pedido.clienteEmail,
                    cpfCnpj: cleanCpf,
                    mobilePhone: (pedido.clienteWhatsapp || '').replace(/\D/g, ''),
                    postalCode: (pedido.endereco?.cep || '').replace(/\D/g, ''),
                    address: pedido.endereco?.rua,
                    addressNumber: pedido.endereco?.numero,
                    province: pedido.endereco?.bairro
                })
            });
            const custData = await createCustRes.json();
            if (!createCustRes.ok) throw new Error(custData.errors?.[0]?.description || 'Erro ao criar cliente Asaas');
            customerId = custData.id;
        }

        // 2. Cria a cobrança PIX no Asaas vinculada ao ID do pedido no Firestore
        const dueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const payRes = await fetch(`${asaasUrl}/payments`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                customer: customerId,
                billingType: 'PIX',
                value: Number(pedido.total),
                dueDate,
                description: `Pedido ArmieMania #${pedidoId.slice(0, 6).toUpperCase()}`,
                externalReference: pedidoId
            })
        });
        const payData = await payRes.json();
        if (!payRes.ok) throw new Error(payData.errors?.[0]?.description || 'Erro ao gerar cobrança Asaas');

        // 3. Obtém o QR Code e Copia-e-Cola do Pix
        const qrRes = await fetch(`${asaasUrl}/payments/${payData.id}/pixQrCode`, { headers });
        const qrData = await qrRes.json();

        await pedidoRef.update({
            asaasPaymentId: payData.id,
            invoiceUrl: payData.invoiceUrl,
            pixCopiaECola: qrData.payload || '',
            pixQrCodeBase64: qrData.encodedImage || ''
        });

        return res.status(200).json({
            paymentId: payData.id,
            invoiceUrl: payData.invoiceUrl,
            pixCopiaECola: qrData.payload,
            pixQrCodeBase64: qrData.encodedImage
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}