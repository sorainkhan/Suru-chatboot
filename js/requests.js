requireAuth(() => {
  db.collection("users")
    .doc(currentUser.uid)
    .collection("friendRequests")
    .onSnapshot((snap) => {
      const el = document.getElementById("reqList");
      if (snap.empty) {
        el.innerHTML = `<div class="empty-state"><div class="ic">ЁЯдЭ</div>ржПржЦржи ржХрзЛржирзЛ ржирждрзБржи рж░рж┐ржХрзЛржпрж╝рзЗрж╕рзНржЯ ржирзЗржЗ</div>`;
        return;
      }
      el.innerHTML = snap.docs
        .map((d) => {
          const r = d.data();
          return `
        <div class="chat-row">
          <div class="avatar">${
            r.fromPhoto ? `<img src="${r.fromPhoto}">` : initialsOf(r.fromName)
          }</div>
          <div class="mid"><div class="name">${escapeHtml(
            r.fromName
          )}</div></div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-primary" onclick="acceptRequest('${ d.id }','${escapeHtml(r.fromName)}','${ r.fromPhoto || "" }')">Accept</button>
            <button class="btn btn-sm btn-outline" onclick="declineRequest('${ d.id }')">Decline</button>
          </div>
        </div>`;
        })
        .join("");
    });
});

async function acceptRequest(fromUid, fromName, fromPhoto) {
  const myRef = db.collection("users").doc(currentUser.uid);
  const otherRef = db.collection("users").doc(fromUid);

  await myRef
    .collection("friends")
    .doc(fromUid)
    .set({
      name: fromName,
      photoURL: fromPhoto,
      since: firebase.firestore.FieldValue.serverTimestamp(),
    });
  await otherRef
    .collection("friends")
    .doc(currentUser.uid)
    .set({
      name: myProfile.name,
      photoURL: myProfile.photoURL || "",
      since: firebase.firestore.FieldValue.serverTimestamp(),
    });

  await db.collection("chats").add({
    type: "direct",
    members: [currentUser.uid, fromUid],
    memberNames: { [currentUser.uid]: myProfile.name, [fromUid]: fromName },
    memberPhotos: {
      [currentUser.uid]: myProfile.photoURL || "",
      [fromUid]: fromPhoto || "",
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessage: { text: "You are now friends ЁЯОЙ", senderId: "" },
  });

  await myRef.collection("friendRequests").doc(fromUid).delete();
  showToast("Friend added");
}

async function declineRequest(fromUid) {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("friendRequests")
    .doc(fromUid)
    .delete();
}
