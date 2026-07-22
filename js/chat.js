const params = new URLSearchParams(location.search);
const chatId = params.get("chatId");
let chatData = null;
let isGroup = false;
let otherUid = null;
let mediaRecorder = null;
let audioChunks = [];
let lastRenderedDay = null;

if (!chatId) window.location.replace("chatlist.html");

requireAuth(async () => {
  const doc = await db.collection("chats").doc(chatId).get();
  if (!doc.exists) {
    alert("চ্যাট পাওয়া যায়নি");
    window.location.replace("chatlist.html");
    return;
  }
  chatData = doc.data();
  isGroup = chatData.type === "group";
  if (!isGroup) otherUid = chatData.members.find((m) => m !== currentUser.uid);
  renderHeader();
  listenMessages();

  // Came here from a notification: jump straight into typing.
  if (params.get("focus") === "1") {
    setTimeout(() => document.getElementById("textInput")?.focus(), 300);
  }
  // Came here from a notification's inline reply that couldn't be
  // sent directly by the service worker — send it now that the app is open.
  const quickReply = params.get("quickReply");
  if (quickReply) {
    await pushMessage({ type: "text", text: decodeURIComponent(quickReply) });
  }
});

// A reply typed in the OS notification tray, relayed here by the service
// worker while this exact chat is already open in another tab/window.
window.handleIncomingQuickReply = async function (incomingChatId, text) {
  if (incomingChatId !== chatId || !text) return;
  await pushMessage({ type: "text", text });
};

function renderHeader() {
  const name = isGroup ? chatData.groupName : chatData.memberNames?.[otherUid];
  const photo = isGroup
    ? chatData.groupPhoto
    : chatData.memberPhotos?.[otherUid];
  document.getElementById("hdrAvatar").innerHTML = photo
    ? `<img src="${photo}">`
    : initialsOf(name);
  document.getElementById("hdrName").textContent =
    name || (isGroup ? "Group" : "User");
  document.getElementById("hdrStatus").textContent = isGroup
    ? `${chatData.members.length} members`
    : "";
}

function callFromHeader(type) {
  createOutgoingCall(chatId, type, chatData.members);
}

// ---------- Messages ----------
function listenMessages() {
  db.collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(50)
    .onSnapshot((snap) => {
      const wrap = document.getElementById("messagesWrap");
      lastRenderedDay = null;
      let html = "";
      const docs = snap.docs.slice().reverse(); // oldest -> newest for display
      docs.forEach((d, i) => {
        const m = d.data();
        html +=
          dayDividerIfNeeded(m.createdAt) +
          messageHTML(d.id, m, i === lastMineIndex(docs));
      });
      wrap.innerHTML =
        html ||
        `<div class="empty-state"><div class="ic">👋</div>মেসেজ পাঠিয়ে কথোপকথন শুরু করুন</div>`;
      const c = document.getElementById("scrollContainer");
      c.scrollTop = c.scrollHeight + 400;
      markSeen(docs);
    });
}

function lastMineIndex(docs) {
  for (let i = docs.length - 1; i >= 0; i--) {
    if (docs[i].data().senderId === currentUser.uid) return i;
  }
  return -1;
}

function dayDividerIfNeeded(ts) {
  if (!ts || !ts.toDate) return "";
  const key = ts.toDate().toDateString();
  if (key === lastRenderedDay) return "";
  lastRenderedDay = key;
  return `<div class="day-divider">${key}</div>`;
}

function messageHTML(id, m, showStatus) {
  const mine = m.senderId === currentUser.uid;
  const reactions = m.reactions || {};
  const reactKeys = Object.values(reactions);
  const uniqueEmojis = [
    ...new Set(
      reactKeys.map((k) => REACTIONS.find((r) => r.key === k)?.emoji || "")
    ),
  ].join("");

  let body = "";
  if (m.type === "image")
    body = `<div class="msg-media"><img src="${m.mediaURL}"></div>`;
  else if (m.type === "video")
    body = `<div class="msg-media"><video src="${m.mediaURL}" controls></video></div>`;
  else if (m.type === "audio")
    body = `<div class="msg-media" style="padding:6px;"><audio src="${m.mediaURL}" controls style="width:200px;"></audio></div>`;
  else body = escapeHtml(m.text);

  const status =
    showStatus && mine
      ? m.seenBy && Object.keys(m.seenBy).some((u) => u !== currentUser.uid)
        ? "Seen"
        : "Sent"
      : "";

  return ` <div class="msg-row ${mine ? "mine" : ""}"> <div class="msg-bubble-wrap"> ${ isGroup && !mine ? `<div class="msg-meta" style="margin-bottom:2px;font-weight:700;">${escapeHtml( m.senderName || "" )}</div>` : "" } <div class="msg-bubble" onmousedown="startMsgHold('${id}')" onmouseup="endMsgHold()" onmouseleave="cancelMsgHold()" ontouchstart="startMsgHold('${id}')" ontouchend="endMsgHold()"> ${body} </div> ${uniqueEmojis ? `<div class="msg-reactions">${uniqueEmojis}</div>` : ""} <div class="msg-meta">${clockTime(m.createdAt)}${ status ? " · " + status : "" }</div> </div> </div>`;
}

async function markSeen(docs) {
  const updates = [];
  docs.forEach((d) => {
    const m = d.data();
    if (
      m.senderId !== currentUser.uid &&
      !(m.seenBy && m.seenBy[currentUser.uid])
    ) {
      updates.push(d.ref.update({ [`seenBy.${currentUser.uid}`]: true }));
    }
  });
  if (updates.length) {
    await Promise.all(updates);
    await db
      .collection("chats")
      .doc(chatId)
      .update({ [`lastMessage.seenBy.${currentUser.uid}`]: true });
  }
}

// ---------- Long-press a bubble to react ----------
let msgHoldTimer = null;
function startMsgHold(msgId) {
  msgHoldTimer = setTimeout(() => showMsgReactionPicker(msgId), 380);
}
function endMsgHold() {
  clearTimeout(msgHoldTimer);
}
function cancelMsgHold() {
  clearTimeout(msgHoldTimer);
}

function showMsgReactionPicker(msgId) {
  const sheet = document.getElementById("infoSheet");
  sheet.innerHTML = `<div class="sheet-handle"></div> <div style="display:flex;justify-content:center;gap:16px;padding:16px;"> ${REACTIONS.map( (r) => `<button style="font-size:28px;" onclick="reactToMessage('${msgId}','${r.key}')">${r.emoji}</button>` ).join("")} </div>`;
  document.getElementById("infoBackdrop").classList.add("open");
  sheet.classList.add("open");
}
async function reactToMessage(msgId, key) {
  await db
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .doc(msgId)
    .update({ [`reactions.${currentUser.uid}`]: key });
  closeInfoSheet();
}

// ---------- Send text ----------
async function sendText() {
  const input = document.getElementById("textInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await pushMessage({ type: "text", text });
}

async function pushMessage(data) {
  const msg = {
    senderId: currentUser.uid,
    senderName: myProfile.name,
    seenBy: { [currentUser.uid]: true },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...data,
  };
  await db.collection("chats").doc(chatId).collection("messages").add(msg);

  let previewText =
    data.text ||
    (data.type === "image"
      ? "📷 Photo"
      : data.type === "video"
      ? "🎬 Video"
      : "🎤 Voice message");
  await db
    .collection("chats")
    .doc(chatId)
    .update({
      lastMessage: {
        text: previewText,
        type: data.type,
        senderId: currentUser.uid,
        seenBy: { [currentUser.uid]: true },
      },
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
}

// ---------- Media message ----------
async function onMediaPicked(e) {
  const file = e.target.files[0];
  if (!file) return;
  const type = file.type.startsWith("video") ? "video" : "image";
  showToast("পাঠানো হচ্ছে...");
  const ref = storage.ref(`chatMedia/${chatId}/${Date.now()}_${file.name}`);
  await ref.put(file);
  const mediaURL = await ref.getDownloadURL();
  await pushMessage({ type, mediaURL });
  e.target.value = "";
}

// ---------- Voice message ----------
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.start();
    document.getElementById("normalInputBar").classList.add("hidden");
    document.getElementById("recInputBar").classList.remove("hidden");
  } catch (err) {
    showToast("মাইক্রোফোন অ্যাক্সেস দরকার");
  }
}
function cancelRecording() {
  if (mediaRecorder) mediaRecorder.stop();
  document.getElementById("recInputBar").classList.add("hidden");
  document.getElementById("normalInputBar").classList.remove("hidden");
}
function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: "audio/webm" });
    const ref = storage.ref(`chatMedia/${chatId}/${Date.now()}_voice.webm`);
    await ref.put(blob);
    const mediaURL = await ref.getDownloadURL();
    await pushMessage({ type: "audio", mediaURL });
  };
  mediaRecorder.stop();
  document.getElementById("recInputBar").classList.add("hidden");
  document.getElementById("normalInputBar").classList.remove("hidden");
}

// ---------- Contact / group info sheet ----------
function openInfoSheet() {
  const name = isGroup ? chatData.groupName : chatData.memberNames?.[otherUid];
  const photo = isGroup
    ? chatData.groupPhoto
    : chatData.memberPhotos?.[otherUid];
  const sheet = document.getElementById("infoSheet");

  let membersHTML = "";
  if (isGroup) {
    membersHTML =
      `<div class="section-label">Members</div>` +
      chatData.members
        .map(
          (uid) => ` <div class="chat-row"> <div class="avatar avatar-sm">${ chatData.memberPhotos?.[uid] ? `<img src="${chatData.memberPhotos[uid]}">` : initialsOf(chatData.memberNames?.[uid]) }</div> <div class="mid"><div class="name">${escapeHtml( chatData.memberNames?.[uid] || "" )}</div></div> </div>`
        )
        .join("");
  }

  sheet.innerHTML = ` <div class="sheet-handle"></div> <div class="info-header"> <div class="avatar avatar-lg">${ photo ? `<img src="${photo}">` : initialsOf(name) }</div> <div class="name">${escapeHtml(name || "")}</div> </div> <div class="info-quick"> <div class="qbtn" onclick="callFromHeader('audio')"><div class="circ">📞</div>Call</div> <div class="qbtn" onclick="callFromHeader('video')"><div class="circ">🎥</div>Video</div> <div class="qbtn" onclick="comingSoon('মিডিয়া')"><div class="circ">🖼️</div>Media</div> ${ isGroup ? "" : `<div class="qbtn" onclick="renameContact()"><div class="circ">✏️</div>Nickname</div>` } </div> ${membersHTML} <div class="sheet-item" onclick="muteChat()">🔕 Mute</div> ${ isGroup ? "" : `<div class="sheet-item" onclick="shareContact()">📤 Share contact</div>` } ${ isGroup ? "" : `<div class="sheet-item" onclick="createGroupWith()">👥 Create group with ${escapeHtml( name || "" )}</div>` } ${ isGroup ? "" : `<div class="sheet-item danger" onclick="blockThisContact()">🚫 Block</div>` } <div class="sheet-item danger" onclick="comingSoon('Report')">⚠️ Report</div> <div class="sheet-item danger" onclick="deleteThisChat()">🗑️ Delete chat</div> `;
  document.getElementById("infoBackdrop").classList.add("open");
  sheet.classList.add("open");
}
function closeInfoSheet() {
  document.getElementById("infoBackdrop").classList.remove("open");
  document.getElementById("infoSheet").classList.remove("open");
}

async function renameContact() {
  const val = prompt("নিক নেম দিন:");
  if (!val) return;
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("chatSettings")
    .doc(chatId)
    .set({ nickname: val }, { merge: true });
  document.getElementById("hdrName").textContent = val;
  closeInfoSheet();
}
async function muteChat() {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("chatSettings")
    .doc(chatId)
    .set({ muted: true }, { merge: true });
  showToast("Muted");
  closeInfoSheet();
}
async function shareContact() {
  const name = chatData.memberNames?.[otherUid];
  if (navigator.share) {
    try {
      await navigator.share({ text: `${name} — Suru Chatbot এ যুক্ত হন` });
    } catch (e) {}
  } else showToast("শেয়ার সাপোর্ট নেই");
  closeInfoSheet();
}
function createGroupWith() {
  window.location.href = "creategroup.html";
}
async function blockThisContact() {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("blockedUsers")
    .doc(otherUid)
    .set({ at: firebase.firestore.FieldValue.serverTimestamp() });
  showToast("Blocked");
  closeInfoSheet();
}
async function deleteThisChat() {
  if (!confirm("চ্যাটটি মুছে ফেলতে চান?")) return;
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("chatSettings")
    .doc(chatId)
    .set(
      { deletedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  window.location.href = "chatlist.html";
  }
