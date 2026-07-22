// ==============================
// Suru Chatbot — Firebase Config
// ==============================

const firebaseConfig = {
  apiKey: "AIzaSyBapnnDHtUYX2HMajgjt3qsIpeuBWpA3k",
  authDomain: "chatbot-c1a41.firebaseapp.com",
  databaseURL: "https://chatbot-c1a41-default-rtdb.firebaseio.com",
  projectId: "chatbot-c1a41",

  // FIXED
  storageBucket: "chatbot-c1a41.appspot.com",

  messagingSenderId: "818795809832",
  appId: "1:818795809832:web:a806b816d0a9a04258391d",
  measurementId: "G-T07K9J8XL8"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Firebase Services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Keep the user logged in
auth.setPersistence(
  firebase.auth.Auth.Persistence.LOCAL
);

// NOTE:
// db.enablePersistence() অনেক সময় AppMint,
// WebView এবং কিছু Android App Wrapper-এ সমস্যা করে।
// তাই আপাতত এটি বন্ধ রাখা হয়েছে।

/*
db.enablePersistence({
  synchronizeTabs: true
}).catch((err) => {
  console.log("Persistence Error:", err);
});
*/

console.log("Firebase Config Loaded Successfully");
