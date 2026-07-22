let confirmationResult = null;
let pendingPhone = "";
let pendingName = "";
let resendCooldown = false;

const stepPhone = document.getElementById("step-phone");
const stepName = document.getElementById("step-name");
const stepOtp = document.getElementById("step-otp");
const stepLoad = document.getElementById("step-loading");

function showStep(step) {
  [stepPhone, stepName, stepOtp, stepLoad].forEach((s) =>
    s.classList.add("hidden")
  );
  step.classList.remove("hidden");
}

function backTo(which) {
  if (which === "phone") showStep(stepPhone);
}

// ---------- Persistent login: never show login twice ----------
auth.onAuthStateChanged(async (user) => {
  if (user) {
    showStep(stepLoad);
    try {
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists && doc.data().name) {
        window.location.replace("home.html");
        return;
      }
    } catch (e) {
      /* fall through to normal login if offline */
    }
    showStep(stepPhone);
  } else {
    showStep(stepPhone);
  }
});

// ---------- Step 1: phone -> Step 2: name ----------
function goToNameStep() {
  const cc = document.getElementById("cc").value.trim();
  const num = document.getElementById("phoneInput").value.trim();
  const errEl = document.getElementById("err-phone");
  errEl.textContent = "";

  if (!num || num.length < 6) {
    errEl.textContent = "সঠিক মোবাইল নাম্বার দিন";
    return;
  }
  pendingPhone = cc + num.replace(/^0+/, "");
  showStep(stepName);
}

// ---------- Step 2: name -> send OTP ----------
function setupRecaptcha() {
  if (window.recaptchaVerifier) return;
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
    "recaptcha-container",
    {
      size: "invisible",
    }
  );
}

function sendOtp(isResend) {
  const errEl = document.getElementById("err-name");
  errEl.textContent = "";

  if (!isResend) {
    const name = document.getElementById("nameInput").value.trim();
    if (!name) {
      errEl.textContent = "আপনার নাম লিখুন";
      return;
    }
    pendingName = name;
  }

  const btn = document.getElementById("sendOtpBtn");
  if (btn) {
    btn.textContent = "পাঠানো হচ্ছে...";
    btn.disabled = true;
  }

  setupRecaptcha();

  auth
    .signInWithPhoneNumber(pendingPhone, window.recaptchaVerifier)
    .then((result) => {
      confirmationResult = result;
      document.getElementById("otpSentTo").textContent =
        pendingPhone + " নাম্বারে একটি কোড পাঠানো হয়েছে";
      showStep(stepOtp);
    })
    .catch((error) => {
      console.error(error);
      errEl.textContent = "OTP পাঠানো যায়নি, আবার চেষ্টা করুন";
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then((id) => grecaptcha.reset(id));
      }
    })
    .finally(() => {
      if (btn) {
        btn.textContent = "OTP পাঠান";
        btn.disabled = false;
      }
    });
}

// ---------- OTP box auto-advance ----------
const otpInputs = document.querySelectorAll("#step-otp .otp-row input");
otpInputs.forEach((inp, idx) => {
  inp.addEventListener("input", () => {
    if (inp.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !inp.value && idx > 0)
      otpInputs[idx - 1].focus();
  });
});

// ---------- Step 3: verify OTP ----------
function verifyOtp() {
  const code = Array.from(otpInputs)
    .map((i) => i.value)
    .join("");
  const errEl = document.getElementById("err-otp");
  errEl.textContent = "";

  if (code.length < 6) {
    errEl.textContent = "৬ ডিজিটের কোডটি সম্পূর্ণ দিন";
    return;
  }
  if (!confirmationResult) {
    errEl.textContent = "আবার OTP পাঠান";
    return;
  }

  showStep(stepLoad);

  confirmationResult
    .confirm(code)
    .then(async (result) => {
      const user = result.user;
      const userRef = db.collection("users").doc(user.uid);
      const existing = await userRef.get();

      if (!existing.exists) {
        await userRef.set({
          phone: pendingPhone,
          name: pendingName,
          photoURL: "",
          coverURL: "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          nameChangedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      window.location.replace("home.html");
    })
    .catch((error) => {
      console.error(error);
      showStep(stepOtp);
      errEl.textContent = "কোডটি সঠিক নয়, আবার চেষ্টা করুন";
    });
                        }
