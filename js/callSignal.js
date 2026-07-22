let seenRingingCallId = null;

if (typeof initialsOf !== "function") {
  var initialsOf = function (name) {
    return (name || "?").trim().charAt(0).toUpperCase();
  };
}

function ensureIncomingCallOverlay() {
  if (document.getElementById("incomingCallOverlay")) return;
  const div = document.createElement("div");
  div.id = "incomingCallOverlay";
  div.className = "incoming-call-overlay";
  div.innerHTML = ` <div class="avatar" id="icAvatar">?</div> <div style="font-weight:700;font-size:19px;" id="icName"></div> <div class="kind" id="icKind"></div> <div class="incoming-call-actions"> <button class="call-decline" onclick="declineIncomingCall()">âœ•</button> <button class="call-accept" onclick="acceptIncomingCall()">ðŸ“ž</button> </div>`;
  document.body.appendChild(div);
}

let activeIncomingCall = null;

function startCallSignalListener() {
  ensureIncomingCallOverlay();
  db.collection("calls")
    .where("members", "array-contains", currentUser.uid)
    .where("status", "==", "ringing")
    .onSnapshot((snap) => {
      let latest = null;
      snap.forEach((d) => {
        const c = d.data();
        if (c.callerId === currentUser.uid) return; // don't ring for my own outgoing call
        if (
          !latest ||
          c.createdAt?.toMillis() > latest.data.createdAt?.toMillis()
        )
          latest = { id: d.id, data: c };
      });

      if (latest) {
        activeIncomingCall = latest;
        showIncomingCallOverlay(latest.data);
      } else if (activeIncomingCall) {
        // it was declined/ended/cancelled elsewhere
        activeIncomingCall = null;
        document
          .getElementById("incomingCallOverlay")
          ?.classList.remove("open");
      }
    });
}

function showIncomingCallOverlay(call) {
  document.getElementById("icAvatar").innerHTML = call.callerPhoto
    ? `<img src="${call.callerPhoto}">`
    : initialsOf(call.callerName);
  document.getElementById("icName").textContent = call.callerName;
  document.getElementById("icKind").textContent =
    (call.type === "video" ? "Video call" : "Audio call") + "â€¦";
  document.getElementById("incomingCallOverlay").classList.add("open");
}

async function acceptIncomingCall() {
  if (!activeIncomingCall) return;
  const { id, data } = activeIncomingCall;
  await db.collection("calls").doc(id).update({ status: "accepted" });
  window.location.href = `call.html?callId=${id}&chatId=${data.chatId}&type=${data.type}&role=callee`;
}
async function declineIncomingCall() {
  if (!activeIncomingCall) return;
  await db
    .collection("calls")
    .doc(activeIncomingCall.id)
    .update({ status: "declined" });
  document.getElementById("incomingCallOverlay").classList.remove("open");
  activeIncomingCall = null;
}

// ---------- Starting an outgoing call (used by chat.html / chatlist.html) ----------
async function createOutgoingCall(chatId, type, members, calleeLabel) {
  const ref = await db.collection("calls").add({
    chatId,
    type,
    members,
    callerId: currentUser.uid,
    callerName: myProfile.name,
    callerPhoto: myProfile.photoURL || "",
    status: "ringing",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  window.location.href = `call.html?callId=${ref.id}&chatId=${chatId}&type=${type}&role=caller`;
}

// Fire up the listener once we know who's logged in.
if (typeof requireAuth === "function") {
  requireAuth(() => startCallSignalListener());
} else if (typeof auth !== "undefined") {
  auth.onAuthStateChanged((user) => {
    if (user) startCallSignalListener();
  });
           }
