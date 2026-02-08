// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDVtvXvX-02DVsPn-97zrUCfVN9t9H1dOs",
    authDomain: "raban-7d606.firebaseapp.com",
    projectId: "raban-7d606",
    storageBucket: "raban-7d606.firebasestorage.app",
    messagingSenderId: "57735110728",
    appId: "1:57735110728:web:1dc86035fc8d01f766f87d"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Obsługa powiadomień w tle
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png' // Upewnij się, że masz ten plik, lub usuń tę linię
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
  // 2. NOWOŚĆ: Ustaw Badge (czerwoną cyferkę) na ikonie
  if (navigator.setAppBadge) {
      // Ustawiamy "1" aby zasygnalizować, że coś jest nowego
      navigator.setAppBadge(1).catch((e) => console.error(e));
  }
});