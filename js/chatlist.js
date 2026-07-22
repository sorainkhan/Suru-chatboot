let friendsMap = {}; // uid -> {name, photoURL}
let chatSettingsMap = {}; // chatId -> {nickname, muted, deletedAt}
let activeStoryUid = null;

requireAuth(async () => {
  renderAvatarInto(document.getElementById("myStoryAvatar"), myProfile);
  await loadFriends();
  await loadChatSettings();
  listenRequests();
  listenChats();
  loadStories();
});

async function loadFriends() {
  const snap = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("friends")
    .get();
  snap.forEach((d) => (friendsMap[d.id] = d.data()));
}

async function loadChatSettings() {
  const snap = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("chatSettings")
    .get();
  snap.forEach((d) => (chatSettingsMap[d.id] = d.data()));
}

// ---------- Friend requests badge ----------
function listenRequests() {
  db.collection("users")
    .doc(currentUser.uid)
    .collection("friendRequests")
    .onSnapshot((snap) => {
      const banner = document.getElementById("requestsBanner");
      const count = document.getElementById("reqCount");
      banner.classList.toggle("hidden", snap.empty);
      count.textContent = snap.size;
    });
}

// ---------- Chats list ----------
function listenChats() {
  db.collection("chats")
    .where("members", "array-contains", currentUser.uid)
    .orderBy("lastMessageAt", "desc")
    .limit(60)
    .onSnapshot(
      (snap) => {
        const rows = [];
        snap.forEach((doc) => {
          const c = doc.data();
          const settings = chatSettingsMap[doc.id] || {};
          if (
            settings.deletedAt &&
            c.lastMessageAt &&
            settings.deletedAt.toMillis() >= c.lastMessageAt.toMillis()
          )
            return;
          rows.push({ id: doc.id, ...c, settings });
        });
        renderChatList(rows);
      },
      (err) => {
        console.error(err);
        document.getElementById(
          "chatList"
        ).innerHTML = `<div class="empty-state"><div class="ic">⚠️</div>চ্যাট লোড করা যায়নি (Firestore index লাগতে পারে — কনসোলে লিংক দেখুন)</div>`;
      }
    );
}

function otherMember(chat) {
  const uid = chat.members.find((m) => m !== currentUser.uid);
  return {
    uid,
    name: chat.memberNames?.[uid] || "User",
    photoURL: chat.memberPhotos?.[uid] || "",
  };
}

let chatsCache = {};

function renderChatList(rows) {
  rows.forEach((r) => (chatsCache[r.id] = r));
  const el = document.getElementById("chatList");
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state"><div class="ic">💬</div>এখনো কোনো চ্যাট নেই। উপরে ফোন নাম্বার দিয়ে বন্ধু খুঁজুন।</div>`;
    return;
  }
  el.innerHTML = rows
    .map((c) => {
      const isGroup = c.type === "group";
      const other = isGroup ? null : otherMember(c);
      const displayName =
        c.settings.nickname || (isGroup ? c.groupName : other.name);
      const avatarSrc = isGroup ? c.groupPhoto : other.photoURL;
      const last = c.lastMessage || {};
      let preview =
        last.text ||
        (last.type === "image"
          ? "📷 Photo"
          : last.type === "video"
          ? "🎬 Video"
          : last.type === "audio"
          ? "🎤 Voice message"
          : "Say hi 👋");
      if (last.senderId === currentUser.uid) preview = "You: " + preview;
      const unread =
        last.senderId &&
        last.senderId !== currentUser.uid &&
        !(last.seenBy && last.seenBy[currentUser.uid]);

      return ` <div class="chat-row" onclick="openChat('${c.id}')"> <div class="avatar">${ avatarSrc ? `<img src="${avatarSrc}">` : initialsOf(displayName) }</div> <div class="mid"> <div class="name">${escapeHtml(displayName)}${ c.settings.muted ? " 🔕" : "" }</div> <div class="preview ${unread ? "unread" : ""}">${escapeHtml( preview )}</div> </div> <div class="side"> <div class="time">${ c.lastMessageAt ? timeAgo(c.lastMessageAt) : "" }</div> <div class="icons"> <span onclick="event.stopPropagation(); startCall('${ c.id }','audio')">📞</span> <span onclick="event.stopPropagation(); startCall('${ c.id }','video')">🎥</span> <span onclick="event.stopPropagation(); openChatSheet('${ c.id }', ${isGroup})">⋯</span> </div> </div> </div>`;
    })
    .join("");
}

function openChat(chatId) {
  window.location.href = "chat.html?chatId=" + chatId;
}
function startCall(chatId, kind) {
  const chat = chatsCache[chatId];
  if (!chat) {
    showToast("চ্যাট লোড হচ্ছে, একটু পর চেষ্টা করুন");
    return;
  }
  createOutgoingCall(chatId, kind, chat.members);
}

// ---------- 3-dot sheet on a chat row ----------
function openChatSheet(chatId, isGroup) {
  const settings = chatSettingsMap[chatId] || {};
  const sheet = document.getElementById("chatSheet");
  sheet.innerHTML = ` <div class="sheet-handle"></div> <div class="sheet-item" onclick="renameChat('${chatId}')">✏️ ${ isGroup ? "Rename group" : "Change nickname" }</div> <div class="sheet-item" onclick="toggleMute('${chatId}')">${ settings.muted ? "🔔 Unmute" : "🔕 Mute" }</div> ${ isGroup ? "" : `<div class="sheet-item danger" onclick="blockContact('${chatId}')">🚫 Block</div>` } <div class="sheet-item danger" onclick="deleteChat('${chatId}')">🗑️ Delete chat</div>`;
  document.getElementById("sheetBackdrop").classList.add("open");
  sheet.classList.add("open");
}
function closeSheet() {
  document.getElementById("sheetBackdrop").classList.remove("open");
  document.getElementById("chatSheet").classList.remove("open");
}
async function saveChatSetting(chatId, data) {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("chatSettings")
    .doc(chatId)
    .set(data, { merge: true });
  chatSettingsMap[chatId] = { ...(chatSettingsMap[chatId] || {}), ...data };
}
async function renameChat(chatId) {
  const val = prompt("নতুন নাম দিন:");
  if (!val) return;
  await saveChatSetting(chatId, { nickname: val });
  closeSheet();
  listenChats();
}
async function toggleMute(chatId) {
  const cur = chatSettingsMap[chatId]?.muted || false;
  await saveChatSetting(chatId, { muted: !cur });
  closeSheet();
  listenChats();
}
async function deleteChat(chatId) {
  closeSheet();
  if (!confirm("এই চ্যাটটি মুছে ফেলতে চান?")) return;
  await saveChatSetting(chatId, {
    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  listenChats();
}
async function blockContact(chatId) {
  const chatDoc = await db.collection("chats").doc(chatId).get();
  const other = otherMember(chatDoc.data());
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("blockedUsers")
    .doc(other.uid)
    .set({ at: firebase.firestore.FieldValue.serverTimestamp() });
  closeSheet();
  showToast("Blocked");
}

// ---------- Search friend by phone -> friend request ----------
let searchDebounce = null;
function onSearchInput() {
  clearTimeout(searchDebounce);
  const q = document.getElementById("searchInput").value.trim();
  const resultsEl = document.getElementById("searchResults");
  if (!q) {
    resultsEl.classList.add("hidden");
    return;
  }
  searchDebounce = setTimeout(async () => {
    const snap = await db
      .collection("users")
      .orderBy("phone")
      .startAt(q)
      .endAt(q + "\uf8ff")
      .limit(10)
      .get();
    const rows = snap.docs.filter((d) => d.id !== currentUser.uid);
    if (!rows.length) {
      resultsEl.innerHTML = `<div class="search-result-row"><span class="name">কোনো ইউজার পাওয়া যায়নি</span></div>`;
    } else {
      resultsEl.innerHTML = rows
        .map((d) => {
          const u = d.data();
          const already = friendsMap[d.id];
          return ` <div class="search-result-row"> <div class="avatar avatar-sm">${ u.photoURL ? `<img src="${u.photoURL}">` : initialsOf(u.name) }</div> <span class="name">${escapeHtml(u.name)} — ${escapeHtml( u.phone )}</span> ${ already ? `<button class="btn btn-sm btn-primary" onclick="messageDirect('${d.id}')">Message</button>` : `<button class="btn btn-sm btn-outline" onclick="sendFriendRequest('${ d.id }','${escapeHtml(u.name)}','${ u.photoURL || "" }')">Add friend</button>` } </div>`;
        })
        .join("");
    }
    resultsEl.classList.remove("hidden");
  }, 350);
}

async function sendFriendRequest(uid, name, photo) {
  await db
    .collection("users")
    .doc(uid)
    .collection("friendRequests")
    .doc(currentUser.uid)
    .set({
      fromName: myProfile.name,
      fromPhoto: myProfile.photoURL || "",
      at: firebase.firestore.FieldValue.serverTimestamp(),
    });
  showToast("Friend request sent");
}

async function messageDirect(uid) {
  // find or create a direct chat with this friend
  const snap = await db
    .collection("chats")
    .where("members", "array-contains", currentUser.uid)
    .get();
  let existing = null;
  snap.forEach((d) => {
    const c = d.data();
    if (c.type === "direct" && c.members.includes(uid)) existing = d.id;
  });
  if (existing) {
    openChat(existing);
    return;
  }

  const friend = friendsMap[uid];
  const ref = await db.collection("chats").add({
    type: "direct",
    members: [currentUser.uid, uid],
    memberNames: { [currentUser.uid]: myProfile.name, [uid]: friend.name },
    memberPhotos: {
      [currentUser.uid]: myProfile.photoURL || "",
      [uid]: friend.photoURL || "",
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessage: { text: "", senderId: "" },
  });
  openChat(ref.id);
}

// ---------- Stories ----------
async function loadStories() {
  const snap = await db
    .collection("stories")
    .orderBy("createdAt", "desc")
    .limit(60)
    .get();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const items = [];
  snap.forEach((d) => {
    const s = d.data();
    if (!s.createdAt || s.createdAt.toDate().getTime() < cutoff) return;
    if (d.id === currentUser.uid) return; // own shown separately
    if (!friendsMap[d.id]) return; // only friends' stories
    items.push({ uid: d.id, ...s });
  });

  const myStory = await db.collection("stories").doc(currentUser.uid).get();
  const myRing = document.querySelector("#storiesRow .story-item .story-ring");
  if (
    myStory.exists &&
    myStory.data().createdAt &&
    myStory.data().createdAt.toDate().getTime() >= cutoff
  ) {
    myRing.onclick = () => openStoryViewer(currentUser.uid, myStory.data());
  }

  const row = document.getElementById("storiesRow");
  row.querySelectorAll(".story-item.friend").forEach((n) => n.remove());
  items.forEach((s) => {
    const div = document.createElement("div");
    div.className = "story-item friend";
    div.onclick = () => openStoryViewer(s.uid, s);
    div.innerHTML = ` <div class="story-ring"> <div class="avatar">${ s.photoURL ? `<img src="${s.photoURL}">` : initialsOf(s.name) }</div> </div> <div class="story-name">${escapeHtml(s.name)}</div>`;
    row.appendChild(div);
  });
}

async function uploadStory(e) {
  const file = e.target.files[0];
  if (!file) return;
  showToast("আপলোড হচ্ছে...");
  const mediaType = file.type.startsWith("video") ? "video" : "image";
  const ref = storage.ref(
    `stories/${currentUser.uid}/${Date.now()}_${file.name}`
  );
  await ref.put(file);
  const mediaURL = await ref.getDownloadURL();
  await db
    .collection("stories")
    .doc(currentUser.uid)
    .set({
      name: myProfile.name,
      photoURL: myProfile.photoURL || "",
      mediaURL,
      mediaType,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      viewers: {},
      reactions: {},
    });
  showToast("স্টোরি পোস্ট হয়েছে");
  loadStories();
}

function openStoryViewer(uid, story) {
  activeStoryUid = uid;
  document.getElementById("storyTopAvatar").innerHTML = story.photoURL
    ? `<img src="${story.photoURL}">`
    : initialsOf(story.name);
  document.getElementById("storyTopName").textContent = story.name;
  document.getElementById("storyTopTime").textContent = timeAgo(
    story.createdAt
  );

  const mediaWrap = document.getElementById("storyMediaWrap");
  mediaWrap.innerHTML =
    story.mediaType === "video"
      ? `<video src="${story.mediaURL}" autoplay controls></video>`
      : `<img src="${story.mediaURL}">`;

  const isMine = uid === currentUser.uid;
  const reactRow = document.getElementById("storyReactRow");
  reactRow.innerHTML = isMine
    ? ""
    : REACTIONS.filter((r) => r.key !== "like")
        .map(
          (r) =>
            `<button onclick="reactToStory('${uid}','${r.key}')">${r.emoji}</button>`
        )
        .join("");

  const bottomBar = document.getElementById("storyBottomBar");
  bottomBar.innerHTML = isMine
    ? `<button class="btn btn-sm btn-outline" style="border-color:#fff;color:#fff;" onclick="openViewersSheet('${uid}')">👁️ ${ Object.keys(story.viewers || {}).length } viewers</button>`
    : `<input placeholder="Reply to story..." id="storyReplyInput"> <button class="send-btn" onclick="replyToStory('${uid}')">➤</button>`;

  document.getElementById("storyOverlay").classList.add("open");

  if (!isMine) {
    db.collection("stories")
      .doc(uid)
      .update({
        [`viewers.${currentUser.uid}`]: {
          name: myProfile.name,
          at: firebase.firestore.FieldValue.serverTimestamp(),
        },
      });
  }
}
function closeStoryViewer() {
  document.getElementById("storyOverlay").classList.remove("open");
}

async function reactToStory(uid, key) {
  await db
    .collection("stories")
    .doc(uid)
    .update({ [`reactions.${currentUser.uid}`]: key });
  showToast("Reacted");
}
async function replyToStory(uid) {
  const input = document.getElementById("storyReplyInput");
  const text = input.value.trim();
  if (!text) return;
  await messageDirect(uid); // ensures a chat exists, then user can continue typing there
}

async function openViewersSheet(uid) {
  const doc = await db.collection("stories").doc(uid).get();
  const viewers = doc.data().viewers || {};
  const reactions = doc.data().reactions || {};
  const sheet = document.getElementById("viewersSheet");
  const keys = Object.keys(viewers);
  sheet.innerHTML = `<div class="sheet-handle"></div> <div class="section-label">Viewed by (${keys.length})</div> <div class="story-viewers-sheet"> ${ keys.length ? keys .map( (uid2) => ` <div class="chat-row"> <div class="avatar avatar-sm">${initialsOf(viewers[uid2].name)}</div> <div class="mid"><div class="name">${escapeHtml( viewers[uid2].name )}</div></div> ${ reactions[uid2] ? `<div style="font-size:18px;">${ REACTIONS.find((r) => r.key === reactions[uid2])?.emoji || "" }</div>` : "" } </div>` ) .join("") : `<div class="empty-state">এখনো কেউ দেখেনি</div>` } </div>`;
  document.getElementById("viewersBackdrop").classList.add("open");
  sheet.classList.add("open");
}
function closeViewersSheet() {
  document.getElementById("viewersBackdrop").classList.remove("open");
  document.getElementById("viewersSheet").classList.remove("open");
          }
