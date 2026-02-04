/**
 * STUDIO RABAN - CLOUD FUNCTIONS (BACKEND)
 * Odpowiedzialne za wysyłanie powiadomień PUSH.
 * Działa bezpiecznie na serwerach Google.
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

// Inicjalizacja z pełnymi uprawnieniami administratora
admin.initializeApp();

// Stała ścieżka do danych (taka sama jak we frontendzie)
// Jeśli zmienisz ID aplikacji w HTML, zmień je też tutaj!
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
 * Reaguje, gdy powstanie nowy dokument w kolekcji 'jobs'
 */
exports.onNewJob = functions.firestore
    .document(`${DATA_PATH}/jobs/{jobId}`)
    .onCreate(async (snap, context) => {
        const job = snap.data();
        
        // Jeśli autor to 'reporter', powiadom rolę 'pax'
        // (Ignorujemy, jeśli Admin dodał zlecenie)
        
        const tokens = await getTokensForRole('pax');
        if (tokens.length === 0) return null;

        const payload = {
            notification: {
                title: "Nowe Zlecenie",
                body: `Nowy temat: ${job.title || 'Bez tytułu'}`,
                icon: 'https://studio-raban-prod.web.app/icon-192.png', // Opcjonalnie: ikona
            }
        };

        // Wysyłamy do wszystkich PAXów naraz
        return admin.messaging().sendToDevice(tokens, payload);
    });

/**
 * TRIGGER 2: Zmiana Statusu (Decyzja PAXa)
 * Reaguje, gdy dokument w 'jobs' zostanie zaktualizowany
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

        // SCENARIUSZ B: Pax odrzucił -> Powiadom Reportera (Autora)
        else if (newData.status === 'rejected') {
            // Tutaj musimy znaleźć token konkretnego autora, a nie wszystkich reporterów
            // Ale dla uproszczenia w wersji v1 powiadomimy rolę 'reporter', 
            // a w v2 zrobimy targetowanie po emailu autora.
            // Na razie: Powiadom reporterów (w tym autora)
            targetRole = 'reporter'; 
            title = "Temat Odrzucony";
            body = `Pax odrzucił temat: "${newData.title}". Uwagi: ${newData.paxComment || 'Brak'}`;
        }

        // SCENARIUSZ C: Producent zatwierdził ekipę -> Powiadom wszystkich (lub Produkcję)
        else if (newData.status === 'production_ready') {
            targetRole = 'production';
            title = "W Realizacji";
            body = `Ekipa zatwierdzona do tematu: "${newData.title}".`;
        }

        if (!targetRole) return null;

        // Pobierz tokeny i wyślij
        const tokens = await getTokensForRole(targetRole);
        
        // Dodatkowy filtr: Jeśli to odrzucenie, spróbujmy wysłać tylko do autora (jeśli mamy jego token w users)
        // (To zaawansowana optymalizacja, na razie zostawiamy broadcast do roli)

        if (tokens.length === 0) return null;

        const payload = {
            notification: {
                title: title,
                body: body,
                icon: 'https://studio-raban-prod.web.app/icon-192.png'
            }
        };

        return admin.messaging().sendToDevice(tokens, payload);
    });