import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Substitua pelas credenciais do seu projeto Firebase
const firebaseConfig = {
apiKey: "AIzaSyDYlS9hzAgytHYpgq4BarkaqTlg29-0FHE",
  authDomain: "armiemania.firebaseapp.com",
  projectId: "armiemania",
  storageBucket: "armiemania.firebasestorage.app",
  messagingSenderId: "219437163989",
  appId: "1:219437163989:web:aee06c2c260e058a6b095c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = getFirestore(app);
