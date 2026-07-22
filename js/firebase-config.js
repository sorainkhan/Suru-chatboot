// ==============================
// Suru Chatbot — Firebase Config
// ==============================
// This uses your existing "Chatbot" Firebase project.
// If you ever create a new Firebase project, just replace
// the values below with the ones from Project settings.

const firebaseConfig = {
  apiKey: "AIzaSyBapnnDHtUYX2HMajgjt3qsIpeuBWpA3k",
  authDomain: "chatbot-c1a41.firebaseapp.com",
  databaseURL: "https://chatbot-c1a41-default-rtdb.firebaseio.com",
  projectId: "chatbot-c1a41",
  storageBucket: "chatbot-c1a41.firebasestorage.app",
  messagingSenderId: "818795809832",
  appId: "1:818795809832:web:a806b816d0a9a04258391d",
  measurementId: "G-T07K9J8XL8",
};

// Initialize Firebase (compat SDK — easiest to run directly from
// GitHub Pages / an AppMint-style wrapper with no build step)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Cache data locally so re-opening a page is instant and the app
// still shows the last-seen feed/chats briefly offline.
db.enablePersistence({ synchronizeTabs: true }).catch(() => {
  // multiple tabs open or unsupported browser — safe to ignore
});

// Keep the user logged in between visits/app restarts
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
