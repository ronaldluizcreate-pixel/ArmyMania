import { auth, googleProvider, db } from './firebase-config.js';
import { 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export let currentUser = null;
export let currentUserData = null;

// Abrir e fechar modal
window.openAuthModal = () => {
    const modal = document.getElementById('authModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeAuthModal = () => {
    const modal = document.getElementById('authModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.toggleAuthMode = (mode) => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const title = document.getElementById('authModalTitle');

    if (mode === 'register') {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        title.innerText = 'Criar Cadastro de Fã';
    } else {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        title.innerText = 'Entrar na sua Conta';
    }
};

// Login com Google
window.loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                nome: user.displayName || "Fã BTS",
                email: user.email,
                idade: null,
                genero: "Não informado",
                bias: "OT7",
                whatsapp: "",
                criadoEm: serverTimestamp()
            });
        }
        closeAuthModal();
    } catch (error) {
        alert("Erro ao entrar com Google: " + error.message);
    }
};

// Cadastro com E-mail e Dados Completos
window.handleEmailRegister = async (e) => {
    e.preventDefault();
    const nome = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const idade = Number(document.getElementById('regAge').value);
    const genero = document.getElementById('regGender').value;
    const whatsapp = document.getElementById('regPhone').value;
    const bias = document.getElementById('regBias').value;
    const password = document.getElementById('regPassword').value;

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "usuarios", cred.user.uid), {
            nome,
            email,
            idade,
            genero,
            whatsapp,
            bias,
            criadoEm: serverTimestamp()
        });
        closeAuthModal();
    } catch (error) {
        alert("Erro no cadastro: " + error.message);
    }
};

// Login com E-mail
window.handleEmailLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeAuthModal();
    } catch (error) {
        alert("E-mail ou senha inválidos.");
    }
};

window.logoutUser = async () => {
    await signOut(auth);
    closeAuthModal();
};

// Observador de Estado de Autenticação
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const authBtnText = document.getElementById('authBtnText');
    const btnMyOrders = document.getElementById('btnMyOrders');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loggedView = document.getElementById('loggedProfileView');

    if (user) {
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        currentUserData = userSnap.exists() ? userSnap.data() : { nome: user.displayName || "Fã BTS", email: user.email, bias: "OT7" };

        const firstName = currentUserData.nome.split(' ')[0];
        authBtnText.innerText = firstName;
        btnMyOrders.classList.remove('hidden');
        btnMyOrders.classList.add('flex');

        // Atualiza visualização interna do modal de perfil
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        loggedView.classList.remove('hidden');
        document.getElementById('authModalTitle').innerText = 'Meu Perfil de Fã';
        document.getElementById('profileInitial').innerText = firstName.charAt(0).toUpperCase();
        document.getElementById('profileNameDisplay').innerText = currentUserData.nome;
        document.getElementById('profileEmailDisplay').innerText = currentUserData.email;
        document.getElementById('profileBiasDisplay').innerText = `Bias: ${currentUserData.bias || 'OT7'}`;
    } else {
        currentUserData = null;
        authBtnText.innerText = 'Entrar';
        btnMyOrders.classList.add('hidden');
        btnMyOrders.classList.remove('flex');
        loggedView.classList.add('hidden');
        toggleAuthMode('login');
    }
});
