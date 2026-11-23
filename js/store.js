import { db } from './firebase-config.js';
import { currentUser, currentUserData } from './auth.js';
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    doc, 
    query, 
    where, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Produtos iniciais de demonstração (exibidos enquanto não houver itens cadastrados no Firestore)
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
        peso: 0.10,
        largura: 12,
        altura: 2,
        comprimento: 16,
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
        peso: 0.08,
        largura: 11,
        altura: 2,
        comprimento: 16,
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
        peso: 0.45,
        largura: 18,
        altura: 12,
        comprimento: 22,
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
        peso: 0.12,
        largura: 11,
        altura: 2,
        comprimento: 16,
        imagem: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=600&q=80'
    }
];

let allProducts = [];
let cart = JSON.parse(localStorage.getItem('armiemania_cart')) || [];
let activeCategory = 'todos';
let deckIndex = 0;
let isCartOpen = false;

// Escutar produtos do Firestore em tempo real
onSnapshot(collection(db, "produtos"), (snapshot) => {
    if (snapshot.empty) {
        allProducts = demoProducts;
    } else {
        allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    if (deckIndex >= allProducts.length) deckIndex = 0;
    renderHeroDeck();
    renderProducts();
}, () => {
    allProducts = demoProducts;
    renderHeroDeck();
    renderProducts();
});

// ==================== BARALHO DE CARTAS NO HERO ====================

function renderHeroDeck() {
    const stack = document.getElementById('heroDeckStack');
    const dotsContainer = document.getElementById('deckDots');
    if (!stack || allProducts.length === 0) return;

    const total = allProducts.length;
    const prevIdx = (deckIndex - 1 + total) % total;
    const nextIdx = (deckIndex + 1) % total;

    const cardsToRender = [];
    if (total > 2) cardsToRender.push({ item: allProducts[prevIdx], role: 'prev' });
    if (total > 1) cardsToRender.push({ item: allProducts[nextIdx], role: 'next' });
    cardsToRender.push({ item: allProducts[deckIndex], role: 'active' });

    stack.innerHTML = cardsToRender.map(({ item, role }) => {
        let styleClasses = '';
        let clickAction = '';

        if (role === 'active') {
            styleClasses = 'z-20 scale-100 rotate-0 translate-x-0 opacity-100 border-armyRed/60 shadow-[0_15px_40px_rgba(230,0,35,0.35)] cursor-pointer hover:scale-[1.02]';
            clickAction = `openProductDetail('${item.id}')`;
        } else if (role === 'next') {
            styleClasses = 'z-10 scale-90 rotate-[8deg] translate-x-10 sm:translate-x-14 translate-y-2 opacity-75 hover:opacity-95 border-white/15 cursor-pointer';
            clickAction = `nextDeckCard()`;
        } else {
            styleClasses = 'z-10 scale-90 -rotate-[8deg] -translate-x-10 sm:-translate-x-14 translate-y-2 opacity-75 hover:opacity-95 border-white/15 cursor-pointer';
            clickAction = `prevDeckCard()`;
        }

        const precoOrig = Number(item.precoOriginal || 0);
        const precoPromo = Number(item.precoPromocional || precoOrig);

        return `
            <div onclick="${clickAction}" class="deck-card absolute inset-0 bg-armyCard border rounded-2xl p-4 flex flex-col justify-between ${styleClasses}">
                <div class="relative rounded-xl overflow-hidden aspect-[4/4] bg-black">
                    <img src="${item.imagem}" alt="${item.nome}" class="w-full h-full object-cover">
                    ${item.promocao ? `<span class="absolute top-3 left-3 bg-armyRed text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider">Promoção</span>` : `<span class="absolute top-3 left-3 bg-black/80 border border-white/15 text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">${item.categoria}</span>`}
                </div>
                <div class="mt-3 flex justify-between items-end gap-2">
                    <div class="overflow-hidden">
                        <h3 class="font-display font-bold text-base truncate">${item.nome}</h3>
                        <p class="text-[11px] text-gray-400 line-clamp-1 mt-0.5">${item.descricao}</p>
                    </div>
                    <div class="text-right shrink-0">
                        ${item.promocao ? `<span class="text-[11px] text-gray-500 line-through block">R$ ${precoOrig.toFixed(2)}</span>` : ''}
                        <span class="text-lg font-display font-black text-armyRed">R$ ${precoPromo.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (dotsContainer) {
        dotsContainer.innerHTML = allProducts.map((_, idx) => `
            <button onclick="goToDeckCard(${idx})" class="h-1.5 rounded-full transition-all ${idx === deckIndex ? 'w-6 bg-armyRed' : 'w-1.5 bg-white/25 hover:bg-white/50'}"></button>
        `).join('');
    }
}

window.nextDeckCard = () => {
    if (allProducts.length <= 1) return;
    deckIndex = (deckIndex + 1) % allProducts.length;
    renderHeroDeck();
};

window.prevDeckCard = () => {
    if (allProducts.length <= 1) return;
    deckIndex = (deckIndex - 1 + allProducts.length) % allProducts.length;
    renderHeroDeck();
};

window.goToDeckCard = (idx) => {
    deckIndex = idx;
    renderHeroDeck();
};

// ==================== VITRINE DE PRODUTOS ====================

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    const filtered = allProducts.filter(p => {
        const matchCat = activeCategory === 'todos' 
            || (activeCategory === 'promocao' && p.promocao) 
            || p.categoria === activeCategory;
        const matchSearch = (p.nome || '').toLowerCase().includes(searchTerm) || (p.descricao || '').toLowerCase().includes(searchTerm);
        return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center text-gray-500 py-12">Nenhum brinde encontrado com esse filtro.</p>`;
        return;
    }

    grid.innerHTML = filtered.map(prod => {
        const precoOrig = Number(prod.precoOriginal || 0);
        const precoPromo = Number(prod.precoPromocional || precoOrig);

        return `
            <div class="photocard-glow bg-armyCard border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between group">
                <div>
                    <div class="relative aspect-square bg-black overflow-hidden">
                        <img id="prod-img-${prod.id}" src="${prod.imagem}" alt="${prod.nome}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
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
                        ${prod.promocao ? `<span class="text-xs text-gray-500 line-through block">R$ ${precoOrig.toFixed(2)}</span>` : ''}
                        <span class="font-display font-black text-lg text-white">R$ ${precoPromo.toFixed(2)}</span>
                    </div>
                    <button onclick="addToCart('${prod.id}', event)" class="px-4 py-2.5 bg-armyRed hover:bg-armyRedHover text-white text-xs font-bold uppercase tracking-wider rounded-lg transition flex items-center gap-1.5 active:scale-95">
                        <i data-lucide="plus" class="w-4 h-4"></i> Comprar
                    </button>
                </div>
            </div>
        `;
    }).join('');

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

const searchEl = document.getElementById('searchInput');
if (searchEl) {
    searchEl.addEventListener('input', renderProducts);
}

// Modal de Detalhes do Produto
window.openProductDetail = (id) => {
    const prod = allProducts.find(p => p.id === id);
    if (!prod) return;

    const precoOrig = Number(prod.precoOriginal || 0);
    const precoPromo = Number(prod.precoPromocional || precoOrig);

    const modal = document.getElementById('productModal');
    const content = document.getElementById('productModalContent');
    content.innerHTML = `
        <button onclick="closeProductModal()" class="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg"><i data-lucide="x" class="w-5 h-5"></i></button>
        <div class="grid sm:grid-cols-2 gap-6 items-center">
            <img id="modal-prod-img-${prod.id}" src="${prod.imagem}" alt="${prod.nome}" class="w-full aspect-square object-cover rounded-xl border border-white/10">
            <div class="space-y-4">
                <span class="px-3 py-1 bg-armyRed/20 text-armyRed text-xs font-bold uppercase rounded-full">${prod.categoria}</span>
                <h3 class="font-display font-black text-2xl">${prod.nome}</h3>
                <p class="text-sm text-gray-300 leading-relaxed">${prod.descricao}</p>
                <div class="pt-2">
                    ${prod.promocao ? `<span class="text-sm text-gray-500 line-through block">De R$ ${precoOrig.toFixed(2)}</span>` : ''}
                    <span class="font-display font-black text-3xl text-armyRed">R$ ${precoPromo.toFixed(2)}</span>
                </div>
                <button onclick="addToCart('${prod.id}', event); closeProductModal();" class="w-full py-3.5 bg-armyRed hover:bg-armyRedHover text-white font-display font-bold uppercase text-xs tracking-wider rounded-lg transition active:scale-95">
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

// ==================== ANIMAÇÃO DE VOO E PULSO NO CARRINHO ====================

function animateFlyToCart(prod, triggerEvent) {
    const cartTarget = document.getElementById('cartBtnTarget');
    if (!cartTarget) return;

    const targetRect = cartTarget.getBoundingClientRect();
    const sourceImg = document.getElementById(`modal-prod-img-${prod.id}`) || document.getElementById(`prod-img-${prod.id}`);
    
    let startX, startY, startW, startH;
    if (sourceImg) {
        const rect = sourceImg.getBoundingClientRect();
        startX = rect.left;
        startY = rect.top;
        startW = rect.width;
        startH = rect.height;
    } else if (triggerEvent && triggerEvent.clientX) {
        startX = triggerEvent.clientX - 30;
        startY = triggerEvent.clientY - 30;
        startW = 60;
        startH = 60;
    } else {
        triggerCartPulse();
        return;
    }

    const flyer = document.createElement('img');
    flyer.src = prod.imagem;
    flyer.className = 'flying-cart-item';
    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    flyer.style.width = `${startW}px`;
    flyer.style.height = `${startH}px`;
    flyer.style.opacity = '0.95';
    document.body.appendChild(flyer);

    requestAnimationFrame(() => {
        flyer.style.left = `${targetRect.left + targetRect.width / 2 - 14}px`;
        flyer.style.top = `${targetRect.top + targetRect.height / 2 - 14}px`;
        flyer.style.width = '28px';
        flyer.style.height = '28px';
        flyer.style.borderRadius = '9999px';
        flyer.style.opacity = '0.2';
    });

    setTimeout(() => {
        flyer.remove();
        triggerCartPulse();
    }, 620);
}

function triggerCartPulse() {
    const cartTarget = document.getElementById('cartBtnTarget');
    const cartCount = document.getElementById('cartCount');
    if (!cartTarget) return;

    cartTarget.classList.remove('cart-pulse-glow');
    void cartTarget.offsetWidth;
    cartTarget.classList.add('cart-pulse-glow');

    if (cartCount) {
        cartCount.classList.add('scale-125', 'bg-armyRed', 'text-white');
        cartCount.classList.remove('bg-white', 'text-armyBlack');
        setTimeout(() => {
            cartCount.classList.remove('scale-125', 'bg-armyRed', 'text-white');
            cartCount.classList.add('bg-white', 'text-armyBlack');
        }, 450);
    }
}

// ==================== CONTROLE DO DRAWER DO CARRINHO ====================

window.toggleCart = (forceState) => {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    const panel = document.getElementById('cartPanel');

    isCartOpen = typeof forceState === 'boolean' ? forceState : !isCartOpen;

    if (isCartOpen) {
        renderCart();
        drawer.classList.remove('pointer-events-none');
        backdrop.classList.remove('opacity-0');
        backdrop.classList.add('opacity-100');
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    } else {
        backdrop.classList.remove('opacity-100');
        backdrop.classList.add('opacity-0');
        panel.classList.remove('translate-x-0');
        panel.classList.add('translate-x-full');
        setTimeout(() => {
            if (!isCartOpen) drawer.classList.add('pointer-events-none');
        }, 300);
    }
};

window.addToCart = (id, event) => {
    const prod = allProducts.find(p => p.id === id);
    if (!prod) return;

    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qtd += 1;
    } else {
        cart.push({ ...prod, qtd: 1 });
    }
    saveCart();
    animateFlyToCart(prod, event);
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
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 text-sm py-10">Seu carrinho está vazio.</p>`;
        document.getElementById('cartSubtotal').innerText = 'R$ 0,00';
        document.getElementById('cartTotal').innerText = 'R$ 0,00';
        return;
    }

    let total = 0;
    container.innerHTML = cart.map(item => {
        const preco = Number(item.precoPromocional || item.precoOriginal || 0);
        total += preco * item.qtd;
        return `
            <div class="flex gap-3 bg-black/40 p-3 rounded-xl border border-white/5 items-center">
                <img src="${item.imagem}" alt="${item.nome}" class="w-16 h-16 rounded-lg object-cover">
                <div class="flex-1">
                    <h4 class="text-sm font-bold line-clamp-1">${item.nome}</h4>
                    <span class="text-xs text-armyRed font-bold">${item.qtd}x R$ ${preco.toFixed(2)}</span>
                </div>
                <button onclick="removeFromCart('${item.id}')" title="Remover item" class="text-gray-500 hover:text-armyRed p-1 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    }).join('');

    document.getElementById('cartSubtotal').innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById('cartTotal').innerText = `R$ ${total.toFixed(2)}`;
    if (window.lucide) lucide.createIcons();
}

// ==================== CHECKOUT COM CPF E BUSCA DE CEP (VIACEP) ====================

window.checkoutOrder = () => {
    if (cart.length === 0) return alert("Adicione itens ao carrinho primeiro!");
    if (!currentUser) {
        toggleCart(false);
        openAuthModal();
        return alert("Faça login ou crie sua conta ArmieMania para finalizar seu pedido com segurança!");
    }

    const subtotal = cart.reduce((acc, item) => acc + (Number(item.precoPromocional || item.precoOriginal || 0) * item.qtd), 0);
    document.getElementById('chkProductsTotal').innerText = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('chkFinalTotal').innerText = `R$ ${subtotal.toFixed(2)}`;

    if (currentUserData) {
        if (currentUserData.cpf) document.getElementById('chkCpf').value = currentUserData.cpf;
        if (currentUserData.whatsapp) document.getElementById('chkWhatsapp').value = currentUserData.whatsapp;
        if (currentUserData.endereco) {
            const e = currentUserData.endereco;
            document.getElementById('chkCep').value = e.cep || '';
            document.getElementById('chkStreet').value = e.rua || '';
            document.getElementById('chkNumber').value = e.numero || '';
            document.getElementById('chkComplement').value = e.complemento || '';
            document.getElementById('chkNeighborhood').value = e.bairro || '';
            document.getElementById('chkCity').value = e.cidade || '';
            document.getElementById('chkState').value = e.estado || '';
        }
    }

    toggleCart(false);
    const modal = document.getElementById('checkoutModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeCheckoutModal = () => {
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.maskCpf = (input) => {
    let v = input.value.replace(/\D/g, '');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;
};

window.fetchAddressByCep = async () => {
    const cepInput = document.getElementById('chkCep');
    const cleanCep = cepInput.value.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    cepInput.value = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (data.erro) {
            alert("CEP não encontrado. Verifique os números digitados.");
            return;
        }
        document.getElementById('chkStreet').value = data.logradouro || '';
        document.getElementById('chkNeighborhood').value = data.bairro || '';
        document.getElementById('chkCity').value = data.localidade || '';
        document.getElementById('chkState').value = data.uf || '';
        document.getElementById('chkNumber').focus();
    } catch (err) {
        console.error("Erro ao consultar ViaCEP:", err);
    }
};

window.confirmCheckoutOrder = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const cpf = document.getElementById('chkCpf').value.trim();
    const whatsapp = document.getElementById('chkWhatsapp').value.trim();
    const endereco = {
        cep: document.getElementById('chkCep').value.trim(),
        rua: document.getElementById('chkStreet').value.trim(),
        numero: document.getElementById('chkNumber').value.trim(),
        complemento: document.getElementById('chkComplement').value.trim(),
        bairro: document.getElementById('chkNeighborhood').value.trim(),
        cidade: document.getElementById('chkCity').value.trim(),
        estado: document.getElementById('chkState').value.trim().toUpperCase()
    };

    const subtotal = cart.reduce((acc, item) => acc + (Number(item.precoPromocional || item.precoOriginal || 0) * item.qtd), 0);

    try {
        await addDoc(collection(db, "pedidos"), {
            clienteId: currentUser.uid,
            clienteNome: currentUserData?.nome || currentUser.email,
            clienteEmail: currentUser.email,
            clienteCpf: cpf,
            clienteWhatsapp: whatsapp,
            endereco,
            itens: cart.map(i => ({
                id: i.id,
                nome: i.nome,
                qtd: i.qtd,
                preco: Number(i.precoPromocional || i.precoOriginal || 0),
                peso: Number(i.peso || 0.15),
                largura: Number(i.largura || 12),
                altura: Number(i.altura || 3),
                comprimento: Number(i.comprimento || 16)
            })),
            subtotal,
            freteValor: 0,
            total: subtotal,
            status: "Aguardando Pagamento",
            gateway: "asaas_pendente",
            criadoEm: serverTimestamp()
        });

        await updateDoc(doc(db, "usuarios", currentUser.uid), {
            cpf,
            whatsapp,
            endereco
        });

        cart = [];
        saveCart();
        closeCheckoutModal();
        alert("Pedido registrado com sucesso! Acompanhe o status e o código de rastreio em 'Meus Pedidos'.");
    } catch (error) {
        alert("Erro ao registrar pedido: " + error.message);
    }
};

// ==================== MEUS PEDIDOS & CÓDIGO DE RASTREIO ====================

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
                    <div class="space-y-1">
                        <span class="text-xs text-gray-500">Pedido #${d.id.slice(0, 6).toUpperCase()}</span>
                        <p class="font-bold text-sm">${o.itens.map(i => `${i.qtd}x ${i.nome}`).join(', ')}</p>
                        <span class="text-armyRed font-display font-bold text-base block">Total: R$ ${Number(o.total).toFixed(2)}</span>
                        ${o.codigoRastreio ? `
                            <div class="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/15 rounded-lg text-xs">
                                <span class="text-gray-400">Rastreio:</span>
                                <strong class="font-mono text-white select-all">${o.codigoRastreio}</strong>
                            </div>
                        ` : ''}
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

saveCart();
