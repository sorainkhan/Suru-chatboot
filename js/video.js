const vParams = new URLSearchParams(location.search);
const profileUid = vParams.get("uid");

let myLikedVideos = new Set();
let myFollowing = new Set();
let pickedVideoFile = null;
let ioObserver = null;

requireAuth(async () => {
  const likedSnap = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("likedVideos")
    .get();
  likedSnap.forEach((d) => myLikedVideos.add(d.id));
  const followSnap = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("following")
    .get();
  followSnap.forEach((d) => myFollowing.add(d.id));
  listenVideos();
});

function listenVideos() {
  let q = db.collection("videos").orderBy("createdAt", "desc").limit(20);
  if (profileUid)
    q = db
      .collection("videos")
      .where("uid", "==", profileUid)
      .orderBy("createdAt", "desc")
      .limit(30);

  q.onSnapshot(
    (snap) => {
      const feed = document.getElementById("videoFeed");
      if (snap.empty) {
        feed.innerHTML = `<div style="height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;text-align:center;padding:0 30px;"> এখনো কোনো ভিডিও নেই।<br>প্রথম ভিডিওটি আপনিই পোস্ট করুন 🎬</div>`;
        return;
      }
      feed.innerHTML = snap.docs
        .map((d) => videoCardHTML(d.id, d.data()))
        .join("");
      setupAutoplay();
    },
    (err) => {
      console.error(err);
      document.getElementById(
        "videoFeed"
      ).innerHTML = `<div style="height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;">ভিডিও লোড করা যায়নি</div>`;
    }
  );
}

function videoCardHTML(id, v) {
  const liked = myLikedVideos.has(id);
  const following = myFollowing.has(v.uid);
  const isMine = v.uid === currentUser.uid;
  const topics = (v.topics || []).map((t) => "#" + t).join(" ");

  return ` <div class="video-card" id="vcard-${id}" data-id="${id}"> <video src="${ v.videoURL }" loop muted playsinline onclick="toggleMute(this)"></video> <div class="shade"></div> <div class="video-info"> <div class="vname"> <span onclick="location.href='video.html?uid=${v.uid}'">@${escapeHtml( v.name )}</span> ${ isMine ? "" : `<button class="vfollow" id="vfollow-${ v.uid }" onclick="toggleFollowV('${v.uid}')">${ following ? "Following" : "Follow" }</button>` } </div> ${v.caption ? `<div class="vcaption">${escapeHtml(v.caption)}</div>` : ""} ${topics ? `<div class="vtopics">${escapeHtml(topics)}</div>` : ""} </div> <div class="video-actions"> <button onclick="location.href='video.html?uid=${v.uid}'"> <div class="avatar circ">${ v.photoURL ? `<img src="${v.photoURL}">` : initialsOf(v.name) }</div> </button> <button onclick="toggleLikeVideo('${id}')"> <div class="circ ${liked ? "liked" : ""}" id="likeCirc-${id}">❤️</div> <span id="likeCount-${id}">${v.likeCount || 0}</span> </button> <button onclick="openCommentsSheet('${id}')"> <div class="circ">💬</div> <span>${v.commentCount || 0}</span> </button> <button onclick="shareVideo('${id}')"> <div class="circ">↗️</div> <span>Share</span> </button> </div> <div class="video-progress"><i id="vprog-${id}"></i></div> </div>`;
}

function toggleMute(videoEl) {
  videoEl.muted = !videoEl.muted;
}

// ---------- Autoplay current card, pause others ----------
function setupAutoplay() {
  if (ioObserver) ioObserver.disconnect();
  const cards = document.querySelectorAll(".video-card");
  ioObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const vid = entry.target.querySelector("video");
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      });
    },
    { threshold: [0, 0.6, 1] }
  );
  cards.forEach((c) => ioObserver.observe(c));

  // progress bar for the visible video
  document
    .getElementById("videoFeed")
    .querySelectorAll("video")
    .forEach((vid) => {
      vid.addEventListener("timeupdate", () => {
        const id = vid.parentElement.dataset.id;
        const bar = document.getElementById("vprog-" + id);
        if (bar && vid.duration)
          bar.style.width = (vid.currentTime / vid.duration) * 100 + "%";
      });
    });
}

// ---------- Like ----------
async function toggleLikeVideo(id) {
  const ref = db.collection("videos").doc(id);
  const likeRef = db
    .collection("users")
    .doc(currentUser.uid)
    .collection("likedVideos")
    .doc(id);
  const isLiked = myLikedVideos.has(id);

  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const count = doc.data().likeCount || 0;
    t.update(ref, { likeCount: isLiked ? Math.max(count - 1, 0) : count + 1 });
    if (isLiked) t.delete(likeRef);
    else
      t.set(likeRef, { at: firebase.firestore.FieldValue.serverTimestamp() });
  });

  if (isLiked) myLikedVideos.delete(id);
  else myLikedVideos.add(id);
  document.getElementById("likeCirc-" + id).classList.toggle("liked", !isLiked);
  document.getElementById("likeCount-" + id).textContent =
    parseInt(document.getElementById("likeCount-" + id).textContent) +
    (isLiked ? -1 : 1);
}

// ---------- Follow ----------
async function toggleFollowV(uid) {
  const ref = db
    .collection("users")
    .doc(currentUser.uid)
    .collection("following")
    .doc(uid);
  const btn = document.getElementById("vfollow-" + uid);
  if (myFollowing.has(uid)) {
    await ref.delete();
    myFollowing.delete(uid);
    if (btn) btn.textContent = "Follow";
  } else {
    await ref.set({ since: firebase.firestore.FieldValue.serverTimestamp() });
    myFollowing.add(uid);
    if (btn) btn.textContent = "Following";
  }
}

// ---------- Share ----------
async function shareVideo(id) {
  const doc = await db.collection("videos").doc(id).get();
  const v = doc.data();
  const text = `${v.caption || "একটি ভিডিও দেখুন Suru ভিডিও-তে"}\n${ v.videoURL }`;
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (e) {}
  } else {
    await navigator.clipboard.writeText(text);
    showToast("লিংক কপি হয়েছে");
  }
}

// ---------- Comments ----------
function openCommentsSheet(videoId) {
  const sheet = document.getElementById("commentsSheet");
  sheet.innerHTML = ` <div class="sheet-handle"></div> <div class="section-label">Comments</div> <div class="video-comments-sheet" id="vComments-${videoId}"><div class="empty-state">লোড হচ্ছে...</div></div> <div class="comment-input-row" style="padding:10px 16px;"> <input placeholder="Write a comment..." id="vCommentInput-${videoId}" onkeydown="if(event.key==='Enter')submitVideoComment('${videoId}')"> <button class="btn btn-sm btn-primary" onclick="submitVideoComment('${videoId}')">Send</button> </div>`;
  document.getElementById("sheetBackdrop").classList.add("open");
  sheet.classList.add("open");

  db.collection("videos")
    .doc(videoId)
    .collection("comments")
    .orderBy("createdAt", "asc")
    .onSnapshot((snap) => {
      const list = document.getElementById("vComments-" + videoId);
      if (!list) return;
      if (snap.empty) {
        list.innerHTML = `<div class="empty-state">এখনো কোনো কমেন্ট নেই</div>`;
        return;
      }
      list.innerHTML = snap.docs
        .map((d) => {
          const c = d.data();
          return ` <div class="comment-row" style="padding:0 16px;"> <div class="avatar avatar-sm">${ c.photoURL ? `<img src="${c.photoURL}">` : initialsOf(c.name) }</div> <div style="flex:1"> <div class="comment-bubble"> <div class="cname">${escapeHtml(c.name)}</div> <div class="ctext">${escapeHtml(c.text)}</div> </div> <div class="comment-meta"><span>${timeAgo( c.createdAt )} ago</span></div> </div> </div>`;
        })
        .join("");
    });
}
function closeCommentsSheet() {
  document.getElementById("sheetBackdrop").classList.remove("open");
  document.getElementById("commentsSheet").classList.remove("open");
}
async function submitVideoComment(videoId) {
  const input = document.getElementById("vCommentInput-" + videoId);
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  const ref = db.collection("videos").doc(videoId);
  await ref.collection("comments").add({
    uid: currentUser.uid,
    name: myProfile.name,
    photoURL: myProfile.photoURL || "",
    text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await ref.update({
    commentCount: firebase.firestore.FieldValue.increment(1),
  });
}

// ---------- Topic search ----------
let vSearchDebounce = null;
function openVideoSearch() {
  document.getElementById("videoSearchBar").classList.add("open");
  document.getElementById("videoSearchResults").classList.add("open");
  document.getElementById("videoFeed").style.display = "none";
  document.getElementById("videoSearchInput").focus();
}
function closeVideoSearch() {
  document.getElementById("videoSearchBar").classList.remove("open");
  document.getElementById("videoSearchResults").classList.remove("open");
  document.getElementById("videoFeed").style.display = "";
  document.getElementById("videoSearchInput").value = "";
}
function onVideoSearch() {
  clearTimeout(vSearchDebounce);
  const q = document
    .getElementById("videoSearchInput")
    .value.trim()
    .toLowerCase();
  const resultsEl = document.getElementById("videoSearchResults");
  if (!q) {
    resultsEl.innerHTML = "";
    return;
  }
  vSearchDebounce = setTimeout(async () => {
    const snap = await db
      .collection("videos")
      .where("topics", "array-contains", q)
      .limit(20)
      .get();
    if (snap.empty) {
      resultsEl.innerHTML = `<div class="empty-state" style="color:#333;">কোনো ভিডিও পাওয়া যায়নি "${escapeHtml( q )}" টপিকে</div>`;
      return;
    }
    resultsEl.innerHTML =
      `<div class="section-label" style="padding-top:16px;">#${escapeHtml( q )}</div>` +
      snap.docs
        .map((d) => {
          const v = d.data();
          return ` <div class="chat-row" onclick="closeVideoSearch(); document.getElementById('vcard-${ d.id }')?.scrollIntoView();"> <div class="avatar avatar-sm">${ v.photoURL ? `<img src="${v.photoURL}">` : initialsOf(v.name) }</div> <div class="mid"><div class="name">${escapeHtml( v.caption || v.name )}</div><div class="preview">@${escapeHtml(v.name)}</div></div> </div>`;
        })
        .join("");
  }, 350);
}

// ---------- Upload ----------
function openUpload() {
  pickedVideoFile = null;
  document.getElementById("videoCaption").value = "";
  document.getElementById("videoTopics").value = "";
  document.getElementById("videoPreviewWrap").innerHTML = "";
  document.getElementById("uploadProgressWrap").classList.add("hidden");
  document.getElementById("uploadBackdrop").classList.add("open");
}
function closeUpload() {
  document.getElementById("uploadBackdrop").classList.remove("open");
}

function onVideoPicked(e) {
  const file = e.target.files[0];
  if (!file) return;
  pickedVideoFile = file;
  document.getElementById(
    "videoPreviewWrap"
  ).innerHTML = `<video src="${URL.createObjectURL( file )}" style="width:100%;border-radius:14px;border:2px solid var(--line);margin-top:10px;" controls></video>`;
}

async function submitVideo() {
  if (!pickedVideoFile) {
    showToast("একটি ভিডিও বেছে নিন");
    return;
  }
  const caption = document.getElementById("videoCaption").value.trim();
  const topics = document
    .getElementById("videoTopics")
    .value.trim()
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const btn = document.getElementById("submitVideoBtn");
  btn.disabled = true;
  btn.textContent = "আপলোড হচ্ছে...";
  document.getElementById("uploadProgressWrap").classList.remove("hidden");

  const ref = storage.ref(
    `videos/${currentUser.uid}/${Date.now()}_${pickedVideoFile.name}`
  );
  const task = ref.put(pickedVideoFile);
  task.on("state_changed", (snap) => {
    const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
    document.getElementById("uploadProgressBar").style.width = pct + "%";
  });

  try {
    await task;
    const videoURL = await ref.getDownloadURL();
    await db.collection("videos").add({
      uid: currentUser.uid,
      name: myProfile.name,
      photoURL: myProfile.photoURL || "",
      videoURL,
      caption,
      topics,
      likeCount: 0,
      commentCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeUpload();
    showToast("ভিডিও পোস্ট হয়েছে!");
  } catch (e) {
    console.error(e);
    showToast("আপলোড ব্যর্থ হয়েছে, আবার চেষ্টা করুন");
  } finally {
    btn.disabled = false;
    btn.textContent = "Post video";
  }
    }
