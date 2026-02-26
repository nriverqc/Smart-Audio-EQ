import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase configuration (Hardcoded for stability)
const firebaseConfig = {
  apiKey: "AIzaSyCL9Ha0xcECnHPsz-yRVXmxuGbR8asX9g8",
  authDomain: "tallerautenticacion-7bd7b.firebaseapp.com",
  projectId: "tallerautenticacion-7bd7b",
  storageBucket: "tallerautenticacion-7bd7b.firebasestorage.app",
  messagingSenderId: "836371529124",
  appId: "1:836371529124:web:0f5e7f1a8c2d9e3b4f5a6b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();