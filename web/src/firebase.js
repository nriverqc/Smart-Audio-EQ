// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCL9Ha0xcECnHPsz-yRVXmxuGbR8asX9g8",
  authDomain: "tallerautenticacion-7bd7b.firebaseapp.com",
  projectId: "tallerautenticacion-7bd7b",
  storageBucket: "tallerautenticacion-7bd7b.firebasestorage.app",
  messagingSenderId: "225297427363",
  appId: "1:225297427363:web:49e39e3e7db7effc4e8816",
  measurementId: "G-DDQ2KDRJM7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
