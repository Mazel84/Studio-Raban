/**
 * STUDIO RABAN - CLOUD FUNCTIONS (BACKEND v2 - MODERN API)
 * Odpowiedzialne za wysyłanie powiadomień PUSH.
 */

const functions = require("firebase-functions/v1"); // Wymuszamy v1 dla stabilności
const admin = require("firebase-admin");

// Inicjalizacja
admin.initializeApp();

// Stała ścieżka do danych
const DATA_PATH = "artifacts/studio-raban-prod/public/data";

/**
 * Funkcja pomocnicza: Pobiera tokeny użytkowników o danej roli
 */
async function getTokensForRole(role) {
    const usersRef = admin.firestore().collection(`${DATA_PATH}/users`);
    const snapshot = await usersRef.where("role", "==", role).get();
    
    const tokens = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.pushToken) {
            tokens.push(data.pushToken);
        }
    });
    return tokens;
}

/**
 * TRIGGER 1: Nowe Zlecenie
 */
exports.onNewJob = functions.firestore
    .document(`${DATA_PATH}/jobs/{jobId}`)
    .onCreate(async (snap, context) => {
        const job = snap.data();
        
        // Pobierz tokeny dla roli 'pax'
        const tokens = await getTokensForRole('pax');
        if (tokens.length === 0) return null;

        // NOWE API: sendEachForMulticast
        const message = {
            tokens: tokens, // Tablica tokenów
            notification: {
                title: "Nowe Zlecenie",
                body: `Nowy temat: ${job.title || 'Bez tytułu'}`
            },
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
    });

/**
 * TRIGGER 2: Zmiana Statusu (Decyzja PAXa)
 */
exports.onJobUpdate = functions.firestore
    .document(`${DATA_PATH}/jobs/{jobId}`)
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        // Jeśli status się nie zmienił, nic nie rób
        if (newData.status === oldData.status) return null;

        let targetRole = null;
        let title = "";
        let body = "";

        // SCENARIUSZ A: Pax zaakceptował -> Powiadom Producenta
        if (newData.status === 'approved_concept') {
            targetRole = 'producer';
            title = "Temat Zaakceptowany";
            body = `Pax przyjął temat: "${newData.title}". Decyzja: Ekipa czy Telefon?`;
        }
        // SCENARIUSZ B: Pax odrzucił -> Powiadom Reportera
        else if (newData.status === 'rejected') {
            targetRole = 'reporter'; 
            title = "Temat Odrzucony";
            body = `Pax odrzucił temat: "${newData.title}". Uwagi: ${newData.paxComment || 'Brak'}`;
        }
        // SCENARIUSZ C: Producent zatwierdził ekipę -> Powiadom Produkcję
        else if (newData.status === 'production_ready') {
            targetRole = 'production';
            title = "W Realizacji";
            body = `Ekipa zatwierdzona do tematu: "${newData.title}".`;
        }

        if (!targetRole) return null;

        const tokens = await getTokensForRole(targetRole);
        if (tokens.length === 0) return null;

        // NOWE API: sendEachForMulticast
        const message = {
            tokens: tokens,
            notification: {
                title: title,
                body: body
            },
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
    });