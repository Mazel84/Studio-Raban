// js/app.js
import { ROLES, STATUS_MAP, COLLECTIONS, CONFIG } from './config.js';
import { Utils, Logger, SafeDOM } from './utils.js';
import { 
    auth, messaging, 
    getToken, onMessage, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from './firebase-init.js';
import { DataService, setRenderCallback } from './data-service.js';
import { UI } from './ui.js';
import { State } from './state.js';
import { Permissions } from './logic.js';
import { Router, Calendar, Selector } from './helpers.js';

// --- AUTH CONTROLLER ---
const Auth = {
    mode: 'login',
    selectedRole: ROLES.REPORTER,
    toggleMode: () => {
        Auth.mode = Auth.mode === 'login' ? 'register' : 'login';
        const isReg = Auth.mode === 'register';
        SafeDOM.setVisible('login-fields', !isReg);
        SafeDOM.setVisible('register-fields', isReg);
        SafeDOM.text('auth-title', isReg ? 'Rejestracja' : 'Logowanie');
        SafeDOM.text('btn-auth-action', isReg ? 'Zarejestruj się' : 'Zaloguj się');
        SafeDOM.text('auth-toggle-link', isReg ? 'Zaloguj się' : 'Zarejestruj się');
    },
    setRole: (r, el) => {
        Auth.selectedRole = r;
        document.querySelectorAll('.role-opt').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
    },
    process: async () => {
        UI.toggleLoader(true);
        try {
            const email = SafeDOM.val(Auth.mode === 'login' ? 'login-email' : 'reg-email');
            const pass = SafeDOM.val(Auth.mode === 'login' ? 'login-pass' : 'reg-pass');
            
            if (Auth.mode === 'login') {
                await signInWithEmailAndPassword(auth, email, pass);
            } else {
                if (pass.length < 6) throw new Error("Hasło min. 6 znaków");
                await createUserWithEmailAndPassword(auth, email, pass);
                await DataService.saveDoc(COLLECTIONS.USERS, {
                    email: email,
                    name: SafeDOM.val('reg-name'),
                    role: email.startsWith('admin') ? ROLES.ADMIN : Auth.selectedRole
                });
            }
        } catch (e) { Logger.error("Auth", e); } finally { UI.toggleLoader(false); }
    },
    logout: async () => { 
        await signOut(auth); 
        location.reload(); 
    }
};

// --- MAIN APP ---
const App = {
    initNotifications: async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                Logger.info("Zgoda na powiadomienia: JEST");
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                const token = await getToken(messaging, { vapidKey: CONFIG.VAPID_KEY, serviceWorkerRegistration: registration });
                
                if (token && State.user && State.user.id) {
                    await DataService.saveDoc(COLLECTIONS.USERS, { pushToken: token }, State.user.id);
                    Logger.info("Token zapisany.");
                    
                    onMessage(messaging, (payload) => {
                        UI.toast(`🔔 ${payload.notification.title}: ${payload.notification.body}`);
                        if(window.Router) App.renderAll();
                    });
                }
            }
        } catch (e) { console.error("Push Error (Silent)", e); }
    },