import { auth, googleProvider, db } from './firebase-config.js';
import { 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// LISTA DE E-MAILS AUTORIZADOS COMO GESTORES
const ADMIN_EMAILS = [
    "ronaldluiz.contato@gmail.com"
];

let ordersData = [];
let productsData = [];
let reviewsData = [];
let usersData = [];

// ==================== AUTENTICAÇÃO DO GESTOR ====================

window.adminLoginGoogle = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        showAuthError("Erro ao autenticar com Google: " + error.message);
    }
};

window.adminLoginEmail = async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showAuthError("E-mail ou senha inválidos.");
    }
};

window.adminLogout = async () => {
    await signOut(auth);
};

function showAuthError(msg) {
    const el = document.getElementById('adminAuthError');
    el.innerText = msg;
    el.classList.remove('hidden');
}

onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('adminLoginScreen');
    const dashboard = document.getElementById('adminDashboard');

    if (user) {
        if (ADMIN_EMAILS.includes(user.email.toLowerCase())) {
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            document.getElementById('loggedAdminEmail').innerText = user.email;
            initRealtimeListeners();
        } else {
            signOut(auth);
            showAuthError(`Acesso negado: o e-mail ${user.email} não tem permissão de gestor.`);
        }
    } else {
        dashboard.classList.add('hidden');
        loginScreen.classList.remove('hidden');
    }
});

// ==================== ESCUTA EM TEMPO REAL (FIRESTORE) ====================

let listenersStarted = false;

function initRealtimeListeners() {
    if (listenersStarted) return;
    listenersStarted = true;

    onSnapshot(collection(db, "pedidos"), (snap) => {
        ordersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        ordersData.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
        updateKPIs();
        renderAdminOrders();
    });

    onSnapshot(collection(db, "produtos"), (snap) => {
        productsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateKPIs();
        renderAdminProducts();
    });

    onSnapshot(collection(db, "depoimentos"), (snap) => {
        reviewsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminReviews();
    });

    onSnapshot(collection(db, "usuarios"), (snap) => {
        usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateKPIs();
        renderAdminUsers();
    });
}

function updateKPIs() {
    const validOrders = ordersData.filter(o => o.status !== "Cancelado");
    const revenue = validOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const pending = ordersData.filter(o => o.status !== "Entregue" && o.status !== "Cancelado").length;

    document.getElementById('kpiRevenue').innerText = `R$ ${revenue.toFixed(2)}`;
    document.getElementById('kpiPendingOrders').innerText = pending;
    document.getElementById('kpiProducts').innerText = productsData.length;
    document.getElementById('kpiCustomers').innerText = usersData.length;
}

// ==================== NAVEGAÇÃO ENTRE ABAS ====================

window.switchAdminTab = (tabName) => {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('bg-armyRed', 'text-white');
        btn.classList.add('bg-white/5', 'text-gray-300');
    });

    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    activeBtn.classList.remove('bg-white/5', 'text-gray-300');
    activeBtn.classList.add('bg-armyRed', 'text-white');
};

// ==================== GESTÃO DE PEDIDOS & ENTREGAS ====================

window.renderAdminOrders = () => {
    const container = document.getElementById('adminOrdersList');
    const filter = document.getElementById('orderStatusFilter').value;

    const filtered = filter === 'todos' 
        ? ordersData 
        : ordersData.filter(o => o.status === filter);

    if (filtered.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10 bg-armyCard rounded-2xl border border-white/10">Nenhum pedido encontrado neste filtro.</p>`;
        return;
    }

    const statuses = [
        "Aguardando Pagamento",
        "Pago / Em Preparação",
        "Enviado",
        "Entregue",
        "Cancelado"
    ];

    container.innerHTML = filtered.map(order => {
        const cleanPhone = (order.clienteWhatsapp || '').replace(/\D/g, '');
        const waMessage = encodeURIComponent(`Olá ${order.clienteNome}! Aqui é da ArmieMania sobre o seu pedido #${order.id.slice(0, 6).toUpperCase()} (${order.status}).`);
        const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${waMessage}` : null;

        const end = order.endereco || {};
        const addressText = end.cep 
            ? `${end.rua}, ${end.numero}${end.complemento ? ' - ' + end.complemento : ''} • ${end.bairro}, ${end.cidade}/${end.estado} (CEP: ${end.cep})`
            : 'Endereço não informado';

        return `
            <div class="bg-armyCard border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div class="space-y-3">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <span class="text-xs font-mono text-armyRed font-bold">#${order.id.slice(0, 6).toUpperCase()}</span>
                            <h4 class="font-bold text-base">${order.clienteNome}</h4>
                            <p class="text-xs text-gray-400">${order.clienteEmail} ${order.clienteCpf ? `• CPF: ${order.clienteCpf}` : ''}</p>
                        </div>
                        <div class="text-right">
                            <span class="font-display font-black text-xl text-white block">R$ ${Number(order.total).toFixed(2)}</span>
                            ${order.freteValor ? `<span class="text-[11px] text-gray-400">Frete (${order.freteServico || 'Envio'}): R$ ${Number(order.freteValor).toFixed(2)}</span>` : ''}
                        </div>
                    </div>

                    <!-- Endereço de Entrega -->
                    <div class="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-gray-300 flex items-start gap-2">
                        <i data-lucide="map-pin" class="w-4 h-4 text-armyRed shrink-0 mt-0.5"></i>
                        <span>${addressText}</span>
                    </div>

                    <!-- Itens do Pedido -->
                    <div class="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1.5">
                        ${(order.itens || []).map(item => `
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-300"><strong class="text-white">${item.qtd}x</strong> ${item.nome}</span>
                                <span class="text-gray-400">R$ ${(item.qtd * item.preco).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Código de Rastreio + Link Etiqueta SuperFrete -->
                    <div class="flex gap-2">
                        <input type="text" id="track-${order.id}" value="${order.codigoRastreio || ''}" placeholder="Código de rastreio" class="flex-1 bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-xs focus:border-armyRed focus:outline-none">
                        <button onclick="saveTrackingCode('${order.id}')" class="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition">Salvar</button>
                        ${order.etiquetaUrl ? `<a href="${order.etiquetaUrl}" target="_blank" class="px-3 py-2 bg-armyRed hover:bg-armyRedHover rounded-lg text-xs font-bold flex items-center gap-1 transition"><i data-lucide="printer" class="w-3.5 h-3.5"></i> Etiqueta</a>` : ''}
                    </div>
                </div>

                <!-- Controles de Etapa da Venda -->
                <div class="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <select onchange="updateOrderStatus('${order.id}', this.value)" class="bg-black border border-armyRed/50 text-white rounded-lg px-3 py-2 text-xs font-bold focus:outline-none">
                        ${statuses.map(st => `<option value="${st}" ${order.status === st ? 'selected' : ''}>${st}</option>`).join('')}
                    </select>

                    ${waLink ? `
                        <a href="${waLink}" target="_blank" class="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1.5 transition">
                            <i data-lucide="message-circle" class="w-4 h-4"></i> WhatsApp
                        </a>
                    ` : `<span class="text-[11px] text-gray-500">Sem WhatsApp</span>`}
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
};

window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        await updateDoc(doc(db, "pedidos", orderId), { status: newStatus });
    } catch (error) {
        alert("Erro ao atualizar status: " + error.message);
    }
};

window.saveTrackingCode = async (orderId) => {
    const code = document.getElementById(`track-${orderId}`).value.trim();
    try {
        await updateDoc(doc(db, "pedidos", orderId), { codigoRastreio: code });
        alert("Código de rastreio salvo!");
    } catch (error) {
        alert("Erro ao salvar rastreio: " + error.message);
    }
};

// ==================== GESTÃO DE PRODUTOS & MEDIDAS ====================

function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if (productsData.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10 bg-armyCard rounded-2xl border border-white/10">Nenhum brinde cadastrado no banco ainda. Clique em "+ Novo Brinde" para começar!</p>`;
        return;
    }

    grid.innerHTML = productsData.map(prod => `
        <div class="bg-armyCard border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between">
            <div>
                <div class="relative aspect-video bg-black">
                    <img src="${prod.imagem}" alt="${prod.nome}" class="w-full h-full object-cover">
                    ${prod.promocao ? `<span class="absolute top-3 left-3 bg-armyRed text-white text-[10px] font-black uppercase px-2.5 py-1 rounded">Promoção Ativa</span>` : ''}
                    <span class="absolute top-3 right-3 bg-black/80 text-white text-[11px] font-bold px-2.5 py-1 rounded">Estoque: ${prod.estoque}</span>
                </div>
                <div class="p-5">
                    <div class="flex items-center justify-between text-[10px] uppercase tracking-widest text-gray-400">
                        <span>${prod.categoria}</span>
                        <span>${prod.peso || 0.15}kg • ${prod.largura || 12}x${prod.altura || 3}x${prod.comprimento || 16}cm</span>
                    </div>
                    <h4 class="font-display font-bold text-base mt-1">${prod.nome}</h4>
                    <p class="text-xs text-gray-400 mt-1 line-clamp-2">${prod.descricao}</p>
                </div>
            </div>
            <div class="px-5 pb-5 pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                    ${prod.promocao ? `<span class="text-xs text-gray-500 line-through block">R$ ${Number(prod.precoOriginal).toFixed(2)}</span>` : ''}
                    <span class="font-display font-black text-lg text-armyRed">R$ ${Number(prod.precoPromocional).toFixed(2)}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="openProductFormModal('${prod.id}')" title="Editar" class="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteProduct('${prod.id}')" title="Excluir" class="p-2 bg-red-950/60 hover:bg-armyRed rounded-lg transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

window.openProductFormModal = (prodId = null) => {
    const modal = document.getElementById('productFormModal');
    const title = document.getElementById('productFormTitle');
    const preview = document.getElementById('prodImagePreview');

    if (prodId) {
        const prod = productsData.find(p => p.id === prodId);
        if (!prod) return;
        title.innerText = "Editar Brinde";
        document.getElementById('editProdId').value = prod.id;
        document.getElementById('prodName').value = prod.nome;
        document.getElementById('prodCategory').value = prod.categoria;
        document.getElementById('prodStock').value = prod.estoque;
        document.getElementById('prodImage').value = prod.imagem;
        document.getElementById('prodDesc').value = prod.descricao;
        document.getElementById('prodWeight').value = prod.peso || 0.15;
        document.getElementById('prodWidth').value = prod.largura || 12;
        document.getElementById('prodHeight').value = prod.altura || 3;
        document.getElementById('prodLength').value = prod.comprimento || 16;
        document.getElementById('prodPromoToggle').checked = Boolean(prod.promocao);
        document.getElementById('prodOriginalPrice').value = prod.precoOriginal;
        document.getElementById('prodPromoPrice').value = prod.promocao ? prod.precoPromocional : '';
        preview.src = prod.imagem;
        preview.classList.remove('hidden');
    } else {
        title.innerText = "Cadastrar Novo Brinde";
        document.getElementById('editProdId').value = "";
        document.getElementById('prodName').value = "";
        document.getElementById('prodCategory').value = "kits";
        document.getElementById('prodStock').value = 10;
        document.getElementById('prodImage').value = "";
        document.getElementById('prodDesc').value = "";
        document.getElementById('prodWeight').value = 0.15;
        document.getElementById('prodWidth').value = 12;
        document.getElementById('prodHeight').value = 3;
        document.getElementById('prodLength').value = 16;
        document.getElementById('prodPromoToggle').checked = false;
        document.getElementById('prodOriginalPrice').value = "";
        document.getElementById('prodPromoPrice').value = "";
        preview.classList.add('hidden');
    }

    togglePromoFields();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeProductFormModal = () => {
    const modal = document.getElementById('productFormModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.togglePromoFields = () => {
    const isPromo = document.getElementById('prodPromoToggle').checked;
    const promoBox = document.getElementById('promoPriceBox');
    const lblNormal = document.getElementById('lblNormalPrice');
    const promoInput = document.getElementById('prodPromoPrice');

    if (isPromo) {
        promoBox.classList.remove('hidden');
        lblNormal.innerText = "Preço Original (Riscado)";
        promoInput.required = true;
    } else {
        promoBox.classList.add('hidden');
        lblNormal.innerText = "Preço de Venda (R$)";
        promoInput.required = false;
    }
};

window.previewProductImage = () => {
    const url = document.getElementById('prodImage').value;
    const preview = document.getElementById('prodImagePreview');
    if (url) {
        preview.src = url;
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
};

window.saveProduct = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editProdId').value;
    const isPromo = document.getElementById('prodPromoToggle').checked;
    const precoOriginal = Number(document.getElementById('prodOriginalPrice').value);
    const precoPromocional = isPromo ? Number(document.getElementById('prodPromoPrice').value) : precoOriginal;

    const payload = {
        nome: document.getElementById('prodName').value,
        categoria: document.getElementById('prodCategory').value,
        estoque: Number(document.getElementById('prodStock').value),
        imagem: document.getElementById('prodImage').value,
        descricao: document.getElementById('prodDesc').value,
        peso: Number(document.getElementById('prodWeight').value),
        largura: Number(document.getElementById('prodWidth').value),
        altura: Number(document.getElementById('prodHeight').value),
        comprimento: Number(document.getElementById('prodLength').value),
        promocao: isPromo,
        precoOriginal,
        precoPromocional,
        atualizadoEm: serverTimestamp()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "produtos", id), payload);
        } else {
            payload.criadoEm = serverTimestamp();
            await addDoc(collection(db, "produtos"), payload);
        }
        closeProductFormModal();
    } catch (error) {
        alert("Erro ao salvar produto: " + error.message);
    }
};

window.deleteProduct = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este brinde do catálogo?")) return;
    try {
        await deleteDoc(doc(db, "produtos", id));
    } catch (error) {
        alert("Erro ao excluir: " + error.message);
    }
};

// ==================== MODERAÇÃO DE MURAL & CLIENTES ====================

function renderAdminReviews() {
    const list = document.getElementById('adminReviewsList');
    if (reviewsData.length === 0) {
        list.innerHTML = `<p class="text-xs text-gray-500">Nenhum depoimento registrado.</p>`;
        return;
    }
    list.innerHTML = reviewsData.map(r => `
        <div class="bg-armyCard border border-white/10 rounded-xl p-4 flex justify-between items-start gap-3">
            <div>
                <span class="font-bold text-sm">${r.nome}</span>
                <span class="text-[11px] text-armyRed ml-2">Bias: ${r.bias || 'OT7'}</span>
                <p class="text-xs text-gray-300 mt-1">"${r.comentario}"</p>
            </div>
            <button onclick="deleteReview('${r.id}')" title="Remover depoimento" class="text-gray-500 hover:text-armyRed p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

window.deleteReview = async (id) => {
    if (!confirm("Remover este depoimento do mural?")) return;
    await deleteDoc(doc(db, "depoimentos", id));
};

function renderAdminUsers() {
    const list = document.getElementById('adminUsersList');
    if (usersData.length === 0) {
        list.innerHTML = `<p class="text-xs text-gray-500">Nenhum fã cadastrado ainda.</p>`;
        return;
    }
    list.innerHTML = usersData.map(u => `
        <div class="bg-armyCard border border-white/10 rounded-xl p-4 flex justify-between items-center">
            <div>
                <h4 class="font-bold text-sm">${u.nome}</h4>
                <p class="text-xs text-gray-400">${u.email} ${u.whatsapp ? `• ${u.whatsapp}` : ''}</p>
            </div>
            <span class="px-2.5 py-1 bg-armyRed/15 text-armyRed text-xs font-bold rounded-full">${u.bias || 'OT7'}</span>
        </div>
    `).join('');
}
