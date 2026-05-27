/**
 * STUDIO RABAN - CLOUD FUNCTIONS (BACKEND v3)
 * Odpowiedzialne za wysyłanie powiadomień PUSH.
 * 
 * ZMIANA v3: Powiadomienia trafiają do WIELU ról jednocześnie
 * + do konkretnego autora zlecenia (Reportera).
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const DATA_PATH = "artifacts/studio-raban-prod/public/data";

/**
 * Pobiera tokeny push dla WIELU ról naraz (z deduplikacją).
 */
async function getTokensForRoles(roles) {
    const usersRef = admin.firestore().collection(`${DATA_PATH}/users`);
    const tokens = [];
    // Admin zawsze dostaje powiadomienia (dodajemy do każdego zapytania)
    const rolesWithAdmin = [...new Set([...roles, 'admin'])];
    for (const role of rolesWithAdmin) {
        const snapshot = await usersRef.where("role", "==", role).get();
        snapshot.forEach(doc => {
            if (doc.data().pushToken) tokens.push(doc.data().pushToken);
        });
    }
    return [...new Set(tokens)]; // Deduplikacja
}

/**
 * Pobiera token push dla konkretnego użytkownika (po emailu).
 */
async function getTokensForEmail(email) {
    if (!email) return [];
    const usersRef = admin.firestore().collection(`${DATA_PATH}/users`);
    const snapshot = await usersRef.where("email", "==", email).get();
    const tokens = [];
    snapshot.forEach(doc => {
        if (doc.data().pushToken) tokens.push(doc.data().pushToken);
    });
    return tokens;
}

/**
 * Wysyła powiadomienie push do listy tokenów.
 */
async function sendNotification(tokens, title, body) {
    if (!tokens || tokens.length === 0) return;
    const uniqueTokens = [...new Set(tokens)];
    const message = {
        tokens: uniqueTokens,
        notification: { title, body },
        webpush: {
            notification: {
                icon: 'https://studio-raban-prod.web.app/icon-192.png'
            }
        }
    };
    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(response.successCount + ' messages were sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

/**
 * TRIGGER 1: Nowe Zlecenie → Powiadom PAXa + Producenta
 */
exports.onNewJob = functions.firestore
    .document(`${DATA_PATH}/jobs/{jobId}`)
    .onCreate(async (snap) => {
        const job = snap.data();
        const tokens = await getTokensForRoles(['pax', 'producer']);
        await sendNotification(tokens, "Nowe Zlecenie", `Nowy temat: ${job.title || 'Bez tytułu'}`);
    });

/**
 * TRIGGER 2: Zmiana Statusu
 * - approved_concept → Powiadom: Produkcję + Producenta + Autora
 * - rejected         → Powiadom: Autora zlecenia
 * - production_ready → Powiadom: Autora + Producenta + PAXa
 */
exports.onJobUpdate = functions.firestore
    .document(`${DATA_PATH}/jobs/{jobId}`)
    .onUpdate(async (change) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        // Jeśli status się nie zmienił, nic nie rób
        if (newData.status === oldData.status) return null;

        let tokens = [];
        let title = "";
        let body = "";

        // SCENARIUSZ A: PAX zaakceptował → Produkcja + Producent + Autor (Reporter wie, że temat przeszedł)
        if (newData.status === 'approved_concept') {
            const roleTokens = await getTokensForRoles(['production', 'producer']);
            const authorTokens = await getTokensForEmail(newData.author);
            tokens = [...roleTokens, ...authorTokens];
            title = "Temat Zaakceptowany ✅";
            body = `PAX przyjął temat: "${newData.title}". Szukamy ekipy!`;
        }
        // SCENARIUSZ B: PAX odrzucił → Autor + Producent
        else if (newData.status === 'rejected') {
            const producerTokens = await getTokensForRoles(['producer']);
            const authorTokens = await getTokensForEmail(newData.author);
            tokens = [...producerTokens, ...authorTokens];
            title = "Temat Odrzucony ❌";
            body = `PAX odrzucił temat: "${newData.title}". Uwagi: ${newData.paxComment || 'Brak'}`;
        }
        // SCENARIUSZ C: Ekipa zatwierdzona → Autor + Producent + PAX
        else if (newData.status === 'production_ready') {
            const roleTokens = await getTokensForRoles(['producer', 'pax']);
            const authorTokens = await getTokensForEmail(newData.author);
            tokens = [...roleTokens, ...authorTokens];
            title = "Ekipa Gotowa 🎬";
            body = `Ekipa zatwierdzona do tematu: "${newData.title}". Jedziemy!`;
        }

        await sendNotification(tokens, title, body);
    });