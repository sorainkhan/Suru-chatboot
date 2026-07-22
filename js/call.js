const cParams = new URLSearchParams(location.search);
const callId = cParams.get("callId");
const roomChatId = cParams.get("chatId");
const callType = cParams.get("type") || "audio";
const role = cParams.get("role") || "caller";

if (!callId || !roomChatId) window.location.replace("chatlist.html");

let zp = null;
let leftAlready = false;

requireAuth(async () => {
  // Caller waits here; if the callee declines (or it just times out), bail out.
  db.collection("calls")
    .doc(callId)
    .onSnapshot((doc) => {
      if (!doc.exists) return;
      const status = doc.data().status;
      if (status === "declined") {
        document.getElementById("callStatusBar").textContent =
          "কল প্রত্যাখ্যান করা হয়েছে";
        setTimeout(() => leaveAndRedirect(), 1200);
      } else if (status === "ended" && role === "caller") {
        // other side hung up
        leaveAndRedirect();
      }
    });

  // Missed-call timeout: if still ringing after 40s and nobody joined, end it.
  if (role === "caller") {
    setTimeout(async () => {
      const doc = await db.collection("calls").doc(callId).get();
      if (doc.exists && doc.data().status === "ringing") {
        await db.collection("calls").doc(callId).update({ status: "missed" });
        document.getElementById("callStatusBar").textContent = "কেউ ধরেনি";
        setTimeout(() => leaveAndRedirect(), 1500);
      }
    }, 40000);
  }

  joinZegoRoom();
});

function joinZegoRoom() {
  const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
    ZEGO_APP_ID,
    ZEGO_SERVER_SECRET,
    roomChatId,
    currentUser.uid,
    myProfile.name || "User"
  );
  zp = ZegoUIKitPrebuilt.create(kitToken);

  zp.joinRoom({
    container: document.getElementById("callRoomWrap"),
    scenario: { mode: ZegoUIKitPrebuilt.GroupCall }, // works for both 1:1 and group — room just has 2+ people
    turnOnCameraWhenJoining: callType === "video",
    turnOnMicrophoneWhenJoining: true,
    showMyCameraToggleButton: callType === "video",
    showMyMicrophoneToggleButton: true,
    showAudioVideoSettingsButton: true,
    showScreenSharingButton: callType === "video",
    showTextChat: false,
    showUserList: true,
    maxUsers: 100,
    layout: "Auto",
    onJoinRoom: () => {
      document.getElementById("callStatusBar").textContent = "";
      if (role === "callee")
        db.collection("calls")
          .doc(callId)
          .update({ status: "accepted" })
          .catch(() => {});
    },
    onLeaveRoom: () => leaveAndRedirect(),
  });
}

async function leaveAndRedirect() {
  if (leftAlready) return;
  leftAlready = true;
  try {
    const doc = await db.collection("calls").doc(callId).get();
    if (
      doc.exists &&
      doc.data().status !== "declined" &&
      doc.data().status !== "missed"
    ) {
      await db.collection("calls").doc(callId).update({ status: "ended" });
    }
  } catch (e) {}
  window.location.href = `chat.html?chatId=${roomChatId}`;
          }
