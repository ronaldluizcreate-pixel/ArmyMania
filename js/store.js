import { db } from './firebase-config.js';
import { currentUser, currentUserData } from './auth.js';
import { collection, onSnapshot, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Produtos iniciais de demonstração (exibidos enquanto o Gestor não cadastra itens no Firebase)
const demoProducts = [
    {
        id: 'demo1',
        nome: 'Kit Photocards Holográficos - Proof',
        categoria: 'photocards',
        descricao: 'Conjunto com 7 photocards de alta gramatura com acabamento holográfico frente e verso.',
        precoOriginal: 35.00,
        precoPromocional: 24.90,
        promocao: true,
        estoque: 15,
        imagem: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'
    },
    {
        id: 'demo2',
        nome: 'Chaveiro Acrílico Lightstick Ver.4',
        categoria: 'acessorios',
        descricao: 'Chaveiro resistente em acrílico duplo com pingente metálico vermelho.',
        precoOriginal: 22.00,
        precoPromocional: 22.00,
        promocao: false,
        estoque: 20,
        imagem: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=600&q=80'
    },
    {
        id: 'demo3',
        nome: 'Box Surpresa Bias Edition',
        categoria: 'kits',
        descricao: 'Caixa personalizada do seu integrante favorito com caneca, adesivos, pôster A4 e polaroids.',
        precoOriginal: 89.90,
        precoPromocional: 69.90,
        promocao: true,
        estoque: 8,
        imagem: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80'
    },
    {
        id: 'demo4',
        nome: 'Kit 5 Bottons Coleção Dark & Wild',
        categoria: 'acessorios',
        descricao: 'Bottons foscos de 4,5cm resistentes à água para mochilas e jaquetas.',
        precoOriginal: 19.90,
        precoPromocional: 14.90,
        promocao: true,
        estoque: 30,
        imagem: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=600&q=80'
    }
];

let allProducts = [];
let cart = JSON.parse(localStorage.getItem('armiemania_cart')) || [];
let activeCategory = 'todos';

// Escutar produtos do Firestore em tempo real (com fallback para itens de demonstração)
onSnapshot(collection(db, "produtos"), (snapshot) => {
    if (snapshot.empty) {
        allProducts = demoProducts;
    } else {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    renderProducts();
}, () => {
    // Se as chaves do Firebase ainda não foram configuradas, exibe os itens demo
    allProducts = demoProducts;
    renderProducts();
});

// Renderizar vitrine de produtos
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    const filtered = allProducts.filter(p => {
        const matchCat = activeCategory === 'todos' 
            || (activeCategory === 'promocao' && p.promocao) 
            || p.categoria === activeCategory;
        const matchSearch = p.nome.toLowerCase().includes(searchTerm) || p.descricao.toLowerCase().includes(searchTerm);
        return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center text-gray-500 py-12">Nenhum brinde encontrado com esse filtro.</p>`;
        return;
    }

    grid.innerHTML = filtered.map(prod => `
        <div class="photocard-glow bg-armyCard border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between group">
            <div>
                <div class="relative aspect-square bg-black overflow-hidden">
                    <img src="${prod.imagem}" alt="${prod.nome}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                    ${prod.promocao ? `<span class="absolute top-3 left-3 bg-armyRed text-white text-[10px] font-black uppercase px-2.5 py-1 rounded">Promoção</span>` : ''}
                    <button onclick="openProductDetail('${prod.id}')" title="Ver detalhes" class="absolute bottom-3 right-3 p-2.5 bg-black/80 hover:bg-armyRed text-white rounded-full opacity-0 group-hover:opacity-100 transition">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="p-5">
                    <span class="text-[10px] uppercase tracking-widest text-gray-400">${prod.categoria}</span>
                    <h3 class="font-display font-bold text-base mt-1 line-clamp-1">${prod.nome}</h3>
                    <p class="text-xs text-gray-400 mt-1.5 line-clamp-2">${prod.descricao}</p>
                </div>
            </div>
            <div class="px-5 pb-5 pt-2 flex items-center justify-between border-t border-white/5">
                <div>
                    ${prod.promocao ? `<span class="text-xs text-gray-500 line-through block">R$ ${Number(prod.precoOriginal).toFixed(2)}</span>` : ''}
                    <span class="font-display font-black text-lg text-white">R$ ${Number(prod.precoPromocional).toFixed(2)}</span>
                </div>
                <button onclick="addToCart('${prod.id}')" class="px-4 py-2.5 bg-armyRed hover:bg-armyRedHover text-white text-xs font-bold uppercase tracking-wider rounded-lg transition flex items-center gap-1.5">
                    <i data-lucide="plus" class="w-4 h-4"></i> Comprar
                </button>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

// Eventos de Filtro por Categoria
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('bg-armyRed', 'text-white');
            b.classList.add('bg-white/5', 'text-gray-300');
        });
        btn.classList.remove('bg-white/5', 'text-gray-300');
        btn.classList.add('bg-armyRed', 'text-white');
        activeCategory = btn.dataset.cat;
        renderProducts();
    });
});

// Evento de Busca
const searchEl = document.getElementById('searchInput');
if (searchEl) {
    searchEl.addEventListener('input', renderProducts);
}

// Modal de Detalhes do Produto
window.openProductDetail = (id) => {
    const prod = allProducts.find(p => p.id === id);
    if (!prod) return;

    const modal = document.getElementById('productModal');
    const content = document.getElementById('productModalContent');
    content.innerHTML = `
        <button onclick="closeProductModal()" class="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg"><i data-lucide="x" class="w-5 h-5"></i></button>
        <div class="grid sm:grid-cols-2 gap-6 items-center">
            <img src="${prod.imagem}" alt="${prod.nome}" class="w-full aspect-square object-cover rounded-xl border border-white/10">
            <div class="space-y-4">
                <span class="px-3 py-1 bg-armyRed/20 text-armyRed text-xs font-bold uppercase rounded-full">${prod.categoria}</span>
                <h3 class="font-display font-black text-2xl">${prod.nome}</h3>
                <p class="text-sm text-gray-300 leading-relaxed">${prod.descricao}</p>
                <div class="pt-2">
                    ${prod.promocao ? `<span class="text-sm text-gray-500 line-through block">De R$ ${Number(prod.precoOriginal).toFixed(2)}</span>` : ''}
                    <span class="font-display font-black text-3xl text-armyRed">R$ ${Number(prod.precoPromocional).toFixed(2)}</span>
                </div>
                <button onclick="addToCart('${prod.id}'); closeProductModal();" class="w-full py-3.5 bg-armyRed hover:bg-armyRedHover text-white font-display font-bold uppercase text-xs tracking-wider rounded-lg transition">
                    Adicionar ao Carrinho
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
};

window.closeProductModal = () => {
    const modal = document.getElementById('productModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// Controle do Carrinho Lateral
window.toggleCart = () => {
    document.getElementById('cartDrawer').classList.toggle('hidden');
    renderCart();
};

window.addToCart = (id) => {
    const prod = allProducts.find(p => p.id === id);
    if (!prod) return;

    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qtd += 1;
    } else {
        cart.push({ ...prod, qtd: 1 });
    }
    saveCart();
    toggleCart();
};

window.removeFromCart = (id) => {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    renderCart();
};

function saveCart() {
    localStorage.setItem('armiemania_cart', JSON.stringify(cart));
    const totalItems = cart.reduce((acc, item) => acc + item.qtd, 0);
    const countEl = document.getElementById('cartCount');
    if (countEl) countEl.innerText = totalItems;
}

function renderCart() {
    const container = document.getElementById('cartItemsContainer');
    if (cart.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 text-sm py-10">Seu carrinho está vazio.</p>`;
        document.getElementById('cartSubtotal').innerText = 'R$ 0,00';
        document.getElementById('cartTotal').innerText = 'R$ 0,00';
        return;
    }

    let total = 0;
    container.innerHTML = cart.map(item => {
        total += Number(item.precoPromocional) * item.qtd;
        return `
            <div class="flex gap-3 bg-black/40 p-3 rounded-xl border border-white/5 items-center">
                <img src="${item.imagem}" alt="${item.nome}" class="w-16 h-16 rounded-lg object-cover">
                <div class="flex-1">
                    <h4 class="text-sm font-bold line-clamp-1">${item.nome}</h4>
                    <span class="text-xs text-armyRed font-bold">${item.qtd}x R$ ${Number(item.precoPromocional).toFixed(2)}</span>
                </div>
                <button onclick="removeFromCart('${item.id}')" title="Remover item" class="text-gray-500 hover:text-armyRed p-1">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    }).join('');

    document.getElementById('cartSubtotal').innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById('cartTotal').innerText = `R$ ${total.toFixed(2)}`;
    if (window.lucide) lucide.createIcons();
}

// Finalizar Pedido (Salva no Firestore para o Gestor e prepara integração Asaas)
window.checkoutOrder = async () => {
    if (cart.length === 0) return alert("Adicione itens ao carrinho primeiro!");
    if (!currentUser) {
        toggleCart();
        openAuthModal();
        return alert("Faça login ou crie sua conta ArmieMania para finalizar seu pedido com segurança!");
    }

    const total = cart.reduce((acc, item) => acc + (Number(item.precoPromocional) * item.qtd), 0);

    try {
        await addDoc(collection(db, "pedidos"), {
            clienteId: currentUser.uid,
            clienteNome: currentUserData?.nome || currentUser.email,
            clienteEmail: currentUser.email,
            clienteWhatsapp: currentUserData?.whatsapp || "",
            itens: cart.map(i => ({ id: i.id, nome: i.nome, qtd: i.qtd, preco: Number(i.precoPromocional) })),
            total,
            status: "Aguardando Pagamento",
            gateway: "asaas_pendente",
            criadoEm: serverTimestamp()
        });

        cart = [];
        saveCart();
        toggleCart();
        alert("Pedido registrado com sucesso! Acompanhe o status em 'Meus Pedidos'.");
    } catch (error) {
        alert("Erro ao registrar pedido: " + error.message);
    }
};

// Meus Pedidos (Rastreio em tempo real)
window.openOrdersModal = () => {
    if (!currentUser) return openAuthModal();
    const modal = document.getElementById('ordersModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const q = query(collection(db, "pedidos"), where("clienteId", "==", currentUser.uid));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('userOrdersList');
        if (snap.empty) {
            list.innerHTML = `<p class="text-gray-400 text-sm text-center py-6">Você ainda não realizou nenhum pedido.</p>`;
            return;
        }
        list.innerHTML = snap.docs.map(d => {
            const o = d.data();
            return `
                <div class="bg-black/50 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                        <span class="text-xs text-gray-500">Pedido #${d.id.slice(0, 6).toUpperCase()}</span>
                        <p class="font-bold text-sm mt-1">${o.itens.map(i => `${i.qtd}x ${i.nome}`).join(', ')}</p>
                        <span class="text-armyRed font-display font-bold text-base mt-2 block">Total: R$ ${Number(o.total).toFixed(2)}</span>
                    </div>
                    <div class="flex items-center">
                        <span class="px-3 py-1.5 rounded-full text-xs font-bold bg-armyRed/20 text-armyRed border border-armyRed/40">
                            ${o.status}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    });
};

window.closeOrdersModal = () => {
    const modal = document.getElementById('ordersModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// Inicializar contador do carrinho ao carregar a página
saveCart();
