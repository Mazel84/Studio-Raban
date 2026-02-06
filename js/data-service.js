// js/data-service.js
import { db, appId, collection, doc, setDoc, deleteDoc, onSnapshot, query, where, getDocs } from './firebase-init.js';
import { Utils, Logger } from './utils.js';
import { State } from './state.js';
import { COLLECTIONS } from './config.js';

// Mechanizm odświeżania widoku (Callback)
let renderCallback = null;
export const setRenderCallback = (cb) => { renderCallback = cb; };

export const DataService = {
    getCollectionRef: (colName) => {
        return collection(db, 'artifacts', appId, 'public', 'data', colName);
    },

    initListeners: () => {
        const subscribe = (colName, stateKey) => {
            try {
                const ref = DataService.getCollectionRef(colName);
                onSnapshot(ref, (snap) => {
                    State.data[stateKey] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    
                    // Auto-wybór sezonu
                    if (colName === COLLECTIONS.SEASONS && !State.activeSeasonId && State.data.seasons.length > 0) {
                        State.activeSeasonId = State.data.seasons[0].id;
                    }
                    
                    // ODŚWIEŻANIE WIDOKU (Jeśli użytkownik zalogowany)
                    if (State.user && renderCallback) renderCallback();
                    
                }, (err) => Logger.error(`Listener ${colName}`, err));
            } catch (e) { Logger.error(`Init ${colName}`, e); }
        };
        
        subscribe(COLLECTIONS.USERS, 'users');
        subscribe(COLLECTIONS.JOBS, 'jobs');
        subscribe(COLLECTIONS.COSTS, 'extraCosts');
        subscribe(COLLECTIONS.SEASONS, 'seasons');
    },

    saveDoc: async (colName, data, id = null) => {
        try {
            const finalId = id || Utils.generateId();
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', colName, finalId);
            await setDoc(docRef, { ...data, id: finalId }, { merge: true });
            return finalId;
        } catch (e) { throw new Error(e.message); }
    },

    deleteDoc: async (colName, id) => {
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id));
        } catch (e) { throw new Error(e.message); }
    },

    fetchUser: async (email) => {
        if (!email) return null;
        try {
            const q = query(DataService.getCollectionRef(COLLECTIONS.USERS), where("email", "==", email));
            const snap = await getDocs(q);
            return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) { Logger.error("Fetch User", e); return null; }
    }
};