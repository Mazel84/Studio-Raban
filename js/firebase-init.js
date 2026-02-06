// js/firebase-init.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, setDoc, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js';

const firebaseConfig = {
    apiKey: "AIzaSyDVtvXvX-02DVsPn-97zrUCfVN9t9H1dOs",
    authDomain: "raban-7d606.firebaseapp.com",
    projectId: "raban-7d606",
    storageBucket: "raban-7d606.firebasestorage.app",
    messagingSenderId: "57735110728",
    appId: "1:57735110728:web:1dc86035fc8d01f766f87d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);
export const appId = 'studio-raban-prod';

// Sprawdzamy token (logika server-side rendering support)
if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
    signInWithCustomToken(auth, __initial_auth_token).catch(e => console.error("Custom token error", e));
}

// Eksportujemy też funkcje SDK, żeby inne pliki mogły ich używać
export { 
    getToken, onMessage, 
    collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, setDoc, where, getDocs,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
};