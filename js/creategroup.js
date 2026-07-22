let allFriends = [];
let selected = new Set();
let groupPhotoFile = null;

requireAuth(async () => {
  const snap = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("friends")
    .get();
  allFriends = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  renderList();
});

function renderList() {
  const el = document.getElementById("friendPickList");
  if (!allFriends.length) {
    el.innerHTML = `<div class="empty-state"><div class="ic">ЁЯЩБ</div>ржПржЦржирзЛ ржХрзЛржирзЛ ржмржирзНржзрзБ ржирзЗржЗред ржЖржЧрзЗ ржЪрзНржпрж╛ржЯ рж▓рж┐рж╕рзНржЯрзЗ ржЧрж┐ржпрж╝рзЗ ржмржирзНржзрзБ ржпрзЛржЧ ржХрж░рзБржиред</div>`;
    return;
  }
  el.innerHTML = allFriends
    .map(
      (f) => ` <div class="friend-pick-row" onclick="toggleFriend('${f.uid}')"> <div class="avatar avatar-sm">${ f.photoURL ? `<img src="${f.photoURL}">` : initialsOf(f.name) }</div> <div class="name">${escapeHtml(f.name)}</div> <div class="check-circle ${ selected.has(f.uid) ? "checked" : "" }" id="chk-${f.uid}">${selected.has(f.uid) ? "тЬУ" : ""}</div> </div>`
    )
    .join("");
}

function toggleFriend(uid) {
  if (selected.has(uid)) selected.delete(uid);
  else {
    if (selected.size >= 100) {
      showToast(
        "рж╕рж░рзНржмрзЛржЪрзНржЪ рззрзжрзж ржЬржи ржпрзЛржЧ ржХрж░рж╛ ржпрж╛ржмрзЗ"
      );
      return;
    }
    selected.add(uid);
  }
  document.getElementById(
    "pickCount"
  ).textContent = `Select friends (${selected.size} selected)`;
  const chk = document.getElementById("chk-" + uid);
  chk.classList.toggle("checked", selected.has(uid));
  chk.textContent = selected.has(uid) ? "тЬУ" : "";
}

function onGroupPhoto(e) {
  groupPhotoFile = e.target.files[0];
  if (!groupPhotoFile) return;
  document.getElementById(
    "groupAvatarPreview"
  ).innerHTML = `<img src="${URL.createObjectURL(groupPhotoFile)}">`;
}

async function createGroup() {
  const name = document.getElementById("groupNameInput").value.trim();
  if (!name) {
    showToast("ржЧрзНрж░рзБржкрзЗрж░ ржирж╛ржо ржжрж┐ржи");
    return;
  }
  if (selected.size < 1) {
    showToast(
      "ржЕржирзНрждржд рзз ржЬржи ржмржирзНржзрзБ ржмрж╛ржЫрж╛ржЗ ржХрж░рзБржи"
    );
    return;
  }

  showToast("ржЧрзНрж░рзБржк рждрзИрж░рж┐ рж╣ржЪрзНржЫрзЗ...");
  let groupPhoto = "";
  if (groupPhotoFile) {
    const ref = storage.ref(
      `groups/${currentUser.uid}_${Date.now()}_${groupPhotoFile.name}`
    );
    await ref.put(groupPhotoFile);
    groupPhoto = await ref.getDownloadURL();
  }

  const members = [currentUser.uid, ...Array.from(selected)];
  const memberNames = { [currentUser.uid]: myProfile.name };
  const memberPhotos = { [currentUser.uid]: myProfile.photoURL || "" };
  allFriends
    .filter((f) => selected.has(f.uid))
    .forEach((f) => {
      memberNames[f.uid] = f.name;
      memberPhotos[f.uid] = f.photoURL || "";
    });

  const ref = await db.collection("chats").add({
    type: "group",
    groupName: name,
    groupPhoto,
    members,
    memberNames,
    memberPhotos,
    admins: [currentUser.uid],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessage: { text: `${myProfile.name} created the group`, senderId: "" },
  });

  window.location.href = "chat.html?chatId=" + ref.id;
    }
