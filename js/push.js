// Paste your VAPID key here (Firebase Console → Project settings →
// Cloud Messaging → Web configuration → Generate key pair). Push
// notifications silently no-op until this is filled in.
const FCM_VAPID_KEY = "";

async function setupPushNotifications() {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
  if (!FCM_VAPID_KEY) {
    console.warn(
      "Suru: add FCM_VAPID_KEY in js/push.js to enable notifications"
    );
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (token && currentUser) {
      await db
        .collection("users")
        .doc(currentUser.uid)
        .collection("fcmTokens")
        .doc(token)
        .set({
          token,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          ua: navigator.userAgent,
        });
    }

    // App open + focused: show a lightweight in-app toast instead of a
    // system notification (avoids double-notifying the active chat).
    messaging.onMessage((payload) => {
      const data = payload.data || {};
      if (typeof showToast === "function")
        showToast(`${data.title || "নতুন মেসেজ"}: ${data.body || ""}`);
    });

    // Relay quick-replies typed straight from the notification tray.
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (
        event.data?.type === "QUICK_REPLY" &&
        typeof window.handleIncomingQuickReply === "function"
      ) {
        window.handleIncomingQuickReply(event.data.chatId, event.data.text);
      }
    });
  } catch (e) {
    console.warn("Push setup skipped:", e.message);
  }
}

// Call this once we know who's logged in.
if (typeof requireAuth === "function") {
  requireAuth(() => setupPushNotifications());
} else if (typeof auth !== "undefined") {
  auth.onAuthStateChanged((user) => {
    if (user) setupPushNotifications();
  });
      }
