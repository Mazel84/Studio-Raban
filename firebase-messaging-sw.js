importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});