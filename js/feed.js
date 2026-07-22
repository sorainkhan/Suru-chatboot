let currentUser = null;
let myProfile = null;
let blockedUsers = new Set();
let dismissedPosts = new Set();
let savedPosts = new Set();
let myReactions = {}; // postId -> reaction key
let pickedFile = null;
let editingPostId = null;

const REACTIONS = [
  { key: "like", emoji: "ЁЯСН" },
  { key: "love", emoji: "тЭдя╕П" },
  { key: "haha", emoji: "ЁЯШВ" },
  { key: "angry", emoji: "ЁЯШб" },
  { key: "sad", emoji: "ЁЯШв" },
];

// ---------- Auth guard ----------
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.replace("index.html");
    return;
  }
  currentUser = user;
  await loadMyProfile();
  await loadMyLists();
  listenToFeed();
  listenToRequestBadge();
});

function listenToRequestBadge() {
  db.collection("users")
    .doc(currentUser.uid)
    .collection("friendRequests")
    .onSnapshot((snap) => {
      const dot = document.getElementById("reqDot");
      if (dot) dot.classList.toggle("hidden", snap.empty);
    });
}

async function loadMyProfile() {
  const doc = await db.collection("users").doc(currentUser.uid).get();
  myProfile = doc.exists ? doc.data() : { name: "User", photoURL: "" };
  renderAvatar(document.getElementById("myAvatar"), myProfile);
}

function renderAvatar(el, profile) {
  if (profile.photoURL) {
    el.innerHTML = `<img src="${profile.photoURL}" alt="">`;
  } else {
    el.textContent = (profile.name || "?").trim().charAt(0).toUpperCase();
  }
}

async function loadMyLists() {
  const [blockedSnap, dismissedSnap, savedSnap, reactSnap] = await Promise.all([
    db
      .collection("users")
      .doc(currentUser.uid)
      .collection("blockedUsers")
      .get(),
    db.collection("users").doc(currentUser.uid).collection("dismissed").get(),
    db.collection("users").doc(currentUser.uid).collection("saved").get(),
    db.collection("users").doc(currentUser.uid).collection("myReactions").get(),
  ]);
  blockedSnap.forEach((d) => blockedUsers.add(d.id));
  dismissedSnap.forEach((d) => dismissedPosts.add(d.id));
  savedSnap.forEach((d) => savedPosts.add(d.id));
  reactSnap.forEach((d) => (myReactions[d.id] = d.data().reaction));
}

// ---------- Feed ----------
function listenToFeed() {
  db.collection("posts")
    .orderBy("createdAt", "desc")
    .limit(40)
    .onSnapshot(
      (snap) => {
        const posts = [];
        snap.forEach((doc) => {
          const p = doc.data();
          if (blockedUsers.has(p.uid)) return;
          if (dismissedPosts.has(doc.id)) return;
          posts.push({ id: doc.id, ...p });
        });
        renderFeed(posts);
      },
      (err) => {
        console.error(err);
        document.getElementById(
          "feed"
        ).innerHTML = `<div class="empty-state"><div class="ic">тЪая╕П</div>ржкрзЛрж╕рзНржЯ рж▓рзЛржб ржХрж░рж╛ ржпрж╛ржпрж╝ржирж┐</div>`;
      }
    );
}

function timeAgo(ts) {
  if (!ts || !ts.toDate) return "just now";
  const s = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

function renderFeed(posts) {
  const feedEl = document.getElementById("feed");
  if (!posts.length) {
    feedEl.innerHTML = `<div class="empty-state"><div class="ic">ЁЯЧТя╕П</div>ржПржЦржирзЛ ржХрзЛржирзЛ ржкрзЛрж╕рзНржЯ ржирзЗржЗред ржкрзНрж░ржержо ржкрзЛрж╕рзНржЯржЯрж┐ ржЖржкржирж┐ржЗ ржХрж░рзБржи!</div>`;
    return;
  }
  feedEl.innerHTML = posts.map((p) => postCardHTML(p)).join("");
}

function postCardHTML(p) {
  const isMine = p.uid === currentUser.uid;
  const myReact = myReactions[p.id];
  const reactedEmoji = myReact
    ? REACTIONS.find((r) => r.key === myReact).emoji
    : "ЁЯСН";
  const counts = p.reactionCounts || {};
  const totalReacts = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const isSaved = savedPosts.has(p.id);

  let mediaHTML = "";
  if (p.mediaURL) {
    mediaHTML =
      p.mediaType === "video"
        ? `<video class="post-media" src="${p.mediaURL}" controls></video>`
        : `<img class="post-media" src="${p.mediaURL}" alt="">`;
  }

  const initials = (p.name || "?").trim().charAt(0).toUpperCase();
  const avatarHTML = p.photoURL ? `<img src="${p.photoURL}" alt="">` : initials;

  return ` <div class="post-card" id="post-${p.id}"> <div class="post-head"> <div class="avatar avatar-sm">${avatarHTML}</div> <div class="who"> <div class="name">${escapeHtml(p.name || "User")}</div> <div class="time">${timeAgo(p.createdAt)} ago</div> </div> ${ isMine ? "" : `<button class="follow-chip" id="follow-${p.uid}" onclick="toggleFollow('${p.uid}')">Follow</button>` } <button class="post-menu-btn" onclick="openPostSheet('${p.id}','${ p.uid }',${isMine})">тЛп</button> </div> ${p.text ? `<div class="post-text">${escapeHtml(p.text)}</div>` : ""} ${mediaHTML} <div class="post-stats"> <span>${totalReacts ? reactedEmoji + " " + totalReacts : ""}</span> <span>${p.commentCount || 0} comments</span> </div> <div class="post-actions"> <button class="${myReact ? "reacted" : ""}" onmousedown="startHold('${p.id}')" onmouseup="endHold('${ p.id }')" onmouseleave="cancelHold()" ontouchstart="startHold('${p.id}')" ontouchend="endHold('${p.id}')" id="reactBtn-${p.id}"> ${myReact ? reactedEmoji : "ЁЯСН"} ${ myReact ? REACTIONS.find((r) => r.key === myReact).key : "Like" } <div class="reaction-pop" id="reactPop-${p.id}"> ${REACTIONS.map( (r) => `<button onclick="setReaction('${p.id}','${r.key}')">${r.emoji}</button>` ).join("")} </div> </button> <button onclick="toggleComments('${p.id}')">ЁЯТм Comment</button> <button class="${isSaved ? "reacted" : ""}" onclick="toggleSave('${ p.id }')">ЁЯФЦ ${isSaved ? "Saved" : "Save"}</button> <button onclick="sharePost('${p.id}')">тЖЧя╕П Share</button> </div> <div class="comments-box" id="comments-${p.id}"> <div id="commentsList-${ p.id }"><div class="time">рж▓рзЛржб рж╣ржЪрзНржЫрзЗ...</div></div> <div class="comment-input-row"> <input placeholder="Write a comment..." id="commentInput-${ p.id }" onkeydown="if(event.key==='Enter')submitComment('${p.id}')"> <button class="btn btn-sm btn-primary" onclick="submitComment('${ p.id }')">Send</button> </div> </div> </div>`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Reactions (long-press to pick, tap to toggle default like) ----------
let holdTimer = null;
let holdFiredPopup = false;

function startHold(postId) {
  holdFiredPopup = false;
  holdTimer = setTimeout(() => {
    document.getElementById("reactPop-" + postId).classList.add("show");
    holdFiredPopup = true;
  }, 380);
}
function endHold(postId) {
  clearTimeout(holdTimer);
  if (!holdFiredPopup) {
    const current = myReactions[postId];
    setReaction(postId, current ? null : "like");
  }
  setTimeout(
    () =>
      document.getElementById("reactPop-" + postId)?.classList.remove("show"),
    150
  );
}
function cancelHold() {
  clearTimeout(holdTimer);
}

async function setReaction(postId, key) {
  document.getElementById("reactPop-" + postId)?.classList.remove("show");
  const postRef = db.collection("posts").doc(postId);
  const myReactRef = db
    .collection("users")
    .doc(currentUser.uid)
    .collection("myReactions")
    .doc(postId);
  const prev = myReactions[postId];

  await db.runTransaction(async (t) => {
    const postDoc = await t.get(postRef);
    if (!postDoc.exists) return;
    const counts = postDoc.data().reactionCounts || {};
    if (prev) counts[prev] = Math.max((counts[prev] || 1) - 1, 0);
    if (key) counts[key] = (counts[key] || 0) + 1;
    t.update(postRef, { reactionCounts: counts });
    if (key) t.set(myReactRef, { reaction: key });
    else t.delete(myReactRef);
  });

  if (key) myReactions[postId] = key;
  else delete myReactions[postId];
  listenToFeed(); // cheap re-render via fresh snapshot (already live, but ensures instant local update too)
}

// ---------- Comments ----------
const openComments = new Set();
function toggleComments(postId) {
  const box = document.getElementById("comments-" + postId);
  box.classList.toggle("open");
  if (box.classList.contains("open") && !openComments.has(postId)) {
    openComments.add(postId);
    db.collection("posts")
      .doc(postId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .onSnapshot((snap) => {
        const list = document.getElementById("commentsList-" + postId);
        if (!list) return;
        if (snap.empty) {
          list.innerHTML = `<div class="time">ржПржЦржирзЛ ржХрзЛржирзЛ ржХржорзЗржирзНржЯ ржирзЗржЗ</div>`;
          return;
        }
        list.innerHTML = snap.docs
          .map((d) => commentHTML(postId, d.id, d.data()))
          .join("");
      });
  }
}

function commentHTML(postId, cid, c) {
  const liked = c.likes && c.likes[currentUser.uid];
  const likeCount = c.likes ? Object.keys(c.likes).length : 0;
  return ` <div class="comment-row"> <div class="avatar avatar-sm" style="width:30px;height:30px;font-size:11px;">${( c.name || "?" ) .charAt(0) .toUpperCase()}</div> <div style="flex:1"> <div class="comment-bubble"> <div class="cname">${escapeHtml(c.name || "User")}</div> <div class="ctext">${escapeHtml(c.text)}</div> </div> <div class="comment-meta"> <span>${timeAgo(c.createdAt)} ago</span> <button class="${ liked ? "liked" : "" }" onclick="toggleCommentLike('${postId}','${cid}')">Like${ likeCount ? " ┬╖ " + likeCount : "" }</button> <button onclick="focusReply('${postId}','${escapeHtml( c.name || "User" )}')">Reply</button> </div> </div> </div>`;
}

function focusReply(postId, name) {
  const input = document.getElementById("commentInput-" + postId);
  input.value = "@" + name + " ";
  input.focus();
}

async function submitComment(postId) {
  const input = document.getElementById("commentInput-" + postId);
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  const postRef = db.collection("posts").doc(postId);
  await postRef.collection("comments").add({
    uid: currentUser.uid,
    name: myProfile.name,
    photoURL: myProfile.photoURL || "",
    text,
    likes: {},
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await postRef.update({
    commentCount: firebase.firestore.FieldValue.increment(1),
  });
}

async function toggleCommentLike(postId, cid) {
  const ref = db
    .collection("posts")
    .doc(postId)
    .collection("comments")
    .doc(cid);
  const doc = await ref.get();
  const likes = doc.data().likes || {};
  if (likes[currentUser.uid]) delete likes[currentUser.uid];
  else likes[currentUser.uid] = true;
  await ref.update({ likes });
}

// ---------- Save ----------
async function toggleSave(postId) {
  const ref = db
    .collection("users")
    .doc(currentUser.uid)
    .collection("saved")
    .doc(postId);
  if (savedPosts.has(postId)) {
    await ref.delete();
    savedPosts.delete(postId);
  } else {
    await ref.set({ savedAt: firebase.firestore.FieldValue.serverTimestamp() });
    savedPosts.add(postId);
  }
  showToast(savedPosts.has(postId) ? "Saved" : "Removed from saved");
}

// ---------- Share (opens native share sheet: WhatsApp / imo / contacts) ----------
async function sharePost(postId) {
  const doc = await db.collection("posts").doc(postId).get();
  const p = doc.data();
  const shareText =
    (p.text ||
      "ржПржХржЯрж┐ ржкрзЛрж╕рзНржЯ ржжрзЗржЦрзБржи Suru Chatbot-ржП") +
    "\n" +
    (p.mediaURL || "");
  if (navigator.share) {
    try {
      await navigator.share({ text: shareText });
    } catch (e) {}
  } else {
    await navigator.clipboard.writeText(shareText);
    showToast("рж▓рж┐ржВржХ ржХржкрж┐ рж╣ржпрж╝рзЗржЫрзЗ");
  }
}

// ---------- Follow ----------
async function toggleFollow(uid) {
  const ref = db
    .collection("users")
    .doc(currentUser.uid)
    .collection("following")
    .doc(uid);
  const doc = await ref.get();
  const btn = document.getElementById("follow-" + uid);
  if (doc.exists) {
    await ref.delete();
    if (btn) btn.textContent = "Follow";
  } else {
    await ref.set({ since: firebase.firestore.FieldValue.serverTimestamp() });
    if (btn) btn.textContent = "Following";
  }
}

// ---------- Post options sheet ----------
function openPostSheet(postId, ownerUid, isMine) {
  const sheet = document.getElementById("postSheet");
  let items = "";
  if (isMine) {
    items = ` <div class="sheet-item" onclick="editPost('${postId}')">тЬПя╕П Edit post</div> <div class="sheet-item danger" onclick="deletePost('${postId}')">ЁЯЧСя╕П Delete post</div>`;
  } else {
    items = ` <div class="sheet-item" onclick="dismissPost('${postId}')">тЬЦя╕П Hide this post</div> <div class="sheet-item danger" onclick="blockUser('${ownerUid}')">ЁЯЪл Block this person's posts</div>`;
  }
  sheet.innerHTML = `<div class="sheet-handle"></div>${items}`;
  document.getElementById("sheetBackdrop").classList.add("open");
  sheet.classList.add("open");
}
function closeSheet() {
  document.getElementById("sheetBackdrop").classList.remove("open");
  document.getElementById("postSheet").classList.remove("open");
}

async function dismissPost(postId) {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("dismissed")
    .doc(postId)
    .set({ at: firebase.firestore.FieldValue.serverTimestamp() });
  dismissedPosts.add(postId);
  document.getElementById("post-" + postId)?.remove();
  closeSheet();
}
async function blockUser(uid) {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("blockedUsers")
    .doc(uid)
    .set({ at: firebase.firestore.FieldValue.serverTimestamp() });
  blockedUsers.add(uid);
  closeSheet();
  showToast("Blocked");
}
async function deletePost(postId) {
  closeSheet();
  if (
    !confirm(
      "ржПржЗ ржкрзЛрж╕рзНржЯржЯрж┐ ржорзБржЫрзЗ ржлрзЗрж▓рждрзЗ ржЪрж╛ржи?"
    )
  )
    return;
  await db.collection("posts").doc(postId).delete();
}
function editPost(postId) {
  closeSheet();
  db.collection("posts")
    .doc(postId)
    .get()
    .then((doc) => {
      const p = doc.data();
      editingPostId = postId;
      document.getElementById("composeTitle").textContent =
        "ржкрзЛрж╕рзНржЯ ржПржбрж┐ржЯ ржХрж░рзБржи";
      document.getElementById("composeText").value = p.text || "";
      document.getElementById("composeBackdrop").classList.add("open");
    });
}

// ---------- Composer ----------
function openComposer() {
  editingPostId = null;
  pickedFile = null;
  document.getElementById("composeTitle").textContent =
    "ржирждрзБржи ржкрзЛрж╕рзНржЯ";
  document.getElementById("composeText").value = "";
  document.getElementById("composePreviewWrap").innerHTML = "";
  document.getElementById("composeBackdrop").classList.add("open");
}
function closeComposer() {
  document.getElementById("composeBackdrop").classList.remove("open");
}
function onFilePicked(e) {
  const file = e.target.files[0];
  if (!file) return;
  pickedFile = file;
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video");
  document.getElementById("composePreviewWrap").innerHTML = ` <div class="compose-preview"> ${ isVideo ? `<video src="${url}" style="width:100%" controls></video>` : `<img src="${url}" style="width:100%">` } <button class="rm" onclick="removePreview()">тЬХ</button> </div>`;
}
function removePreview() {
  pickedFile = null;
  document.getElementById("composeFile").value = "";
  document.getElementById("composePreviewWrap").innerHTML = "";
}

async function submitPost() {
  const text = document.getElementById("composeText").value.trim();
  if (!text && !pickedFile && !editingPostId) {
    showToast(
      "ржХрж┐ржЫрзБ рж▓рж┐ржЦрзБржи ржмрж╛ ржЫржмрж┐ ржпрзЛржЧ ржХрж░рзБржи"
    );
    return;
  }

  const btn = document.getElementById("submitPostBtn");
  btn.disabled = true;
  btn.textContent = "ржкрзЛрж╕рзНржЯ рж╣ржЪрзНржЫрзЗ...";

  try {
    if (editingPostId) {
      await db
        .collection("posts")
        .doc(editingPostId)
        .update({
          text,
          editedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } else {
      let mediaURL = "",
        mediaType = "";
      if (pickedFile) {
        mediaType = pickedFile.type.startsWith("video") ? "video" : "image";
        const ref = storage.ref(
          `posts/${currentUser.uid}/${Date.now()}_${pickedFile.name}`
        );
        await ref.put(pickedFile);
        mediaURL = await ref.getDownloadURL();
      }
      await db.collection("posts").add({
        uid: currentUser.uid,
        name: myProfile.name,
        photoURL: myProfile.photoURL || "",
        text,
        mediaURL,
        mediaType,
        reactionCounts: {},
        commentCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    closeComposer();
  } catch (e) {
    console.error(e);
    showToast(
      "ржкрзЛрж╕рзНржЯ ржХрж░рж╛ ржпрж╛ржпрж╝ржирж┐, ржЖржмрж╛рж░ ржЪрзЗрж╖рзНржЯрж╛ ржХрж░рзБржи"
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Post";
  }
}

// ---------- Search friend by phone number ----------
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
    if (snap.empty) {
      resultsEl.innerHTML = `<div class="search-result-row"><span class="name">ржХрзЛржирзЛ ржЗржЙржЬрж╛рж░ ржкрж╛ржУржпрж╝рж╛ ржпрж╛ржпрж╝ржирж┐</span></div>`;
    } else {
      resultsEl.innerHTML = snap.docs
        .filter((d) => d.id !== currentUser.uid)
        .map((d) => {
          const u = d.data();
          const initials = (u.name || "?").charAt(0).toUpperCase();
          return ` <div class="search-result-row"> <div class="avatar avatar-sm">${ u.photoURL ? `<img src="${u.photoURL}">` : initials }</div> <span class="name">${escapeHtml(u.name)} тАФ ${escapeHtml( u.phone )}</span> <button class="btn btn-sm btn-outline" onclick="sendFriendRequest('${ d.id }')">Add friend</button> </div>`;
        })
        .join("");
    }
    resultsEl.classList.remove("hidden");
  }, 350);
}

async function sendFriendRequest(uid) {
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

// ---------- Side menu ----------
function openSideMenu() {
  document.getElementById("sideMenu").classList.add("open");
  document.getElementById("sideBackdrop").classList.add("open");
  const mode = localStorage.getItem("suru_theme") || "light";
  setTheme(mode);
}
function closeSideMenu() {
  document.getElementById("sideMenu").classList.remove("open");
  document.getElementById("sideBackdrop").classList.remove("open");
}
function logout() {
  auth.signOut().then(() => window.location.replace("index.html"));
}
function openLikedList() {
  closeSideMenu();
  showToast("рж╢рзАржШрзНрж░ржЗ ржЖрж╕ржЫрзЗ");
}
function openSavedList() {
  closeSideMenu();
  showToast("рж╢рзАржШрзНрж░ржЗ ржЖрж╕ржЫрзЗ");
}

// ---------- Misc ----------
function comingSoon(name) {
  showToast(name + " тАФ ржкрж░ржмрж░рзНрждрзА ржзрж╛ржкрзЗ ржЖрж╕ржЫрзЗ");
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
    }
