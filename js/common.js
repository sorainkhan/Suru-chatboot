let currentUser = null;
let myProfile = { name: "User", photoURL: "" };

function requireAuth(onReady) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.replace("index.html");
      return;
    }
    currentUser = user;
    const doc = await db.collection("users").doc(user.uid).get();
    myProfile = doc.exists ? doc.data() : myProfile;
    onReady(user);
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function initialsOf(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function renderAvatarInto(el, profile) {
  if (profile && profile.photoURL)
    el.innerHTML = `<img src="${profile.photoURL}" alt="">`;
  else el.textContent = initialsOf(profile && profile.name);
}

function timeAgo(ts) {
  if (!ts || !ts.toDate) return "";
  const s = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

function clockTime(ts) {
  if (!ts || !ts.toDate) return "";
  const d = ts.toDate();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ap}`;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

function comingSoon(name) {
  showToast(name + " — পরবর্তী ধাপে আসছে");
}

const REACTIONS = [
  { key: "like", emoji: "👍" },
  { key: "love", emoji: "❤️" },
  { key: "haha", emoji: "😂" },
  { key: "angry", emoji: "😡" },
  { key: "sad", emoji: "😢" },
];
