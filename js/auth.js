let confirmationResult = null;
let pendingPhone = "";
let pendingName = "";
let resendCooldown = false;

const stepPhone = document.getElementById("step-phone");
const stepName = document.getElementById("step-name");
const stepOtp = document.getElementById("step-otp");
const stepLoad = document.getElementById("step-loading");

function showStep(step) {
  [stepPhone, stepName, stepOtp, stepLoad].forEach((s) => {
    if (s) s.classList.add("hidden");
  });
  if (step) step.classList.remove("hidden");
}

function backTo(which) {
  if (which === "phone") showStep(stepPhone);
}

// ---------- Persistent login ----------
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
      /* offline handle */
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
  if (errEl) errEl.textContent = "";

  if (!num || num.length < 6) {
    if (errEl) errEl.textContent = "সঠিক মোবাইল নাম্বার দিন";
    return;
  }
  
  // Clean phone number (Only numbers)
  const cleanNum = num.replace(/\D/g, '').replace(/^0+/, '');
  pendingPhone = cc + cleanNum;
  showStep(stepName);
}

// ---------- Step 2: setup reCAPTCHA & send OTP ----------
function setupRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      "recaptcha-container",
      {
        size: "invisible",
        callback: (response) => {
          // reCAPTCHA solved
        }
      }
    );
  }
}

function sendOtp(isResend) {
  const errEl = document.getElementById("err-name");
  if (errEl) errEl.textContent = "";

  if (!isResend) {
    const name = document.getElementById("nameInput").value.trim();
    if (!name) {
      if (errEl) errEl.textContent = "আপনার নাম লিখুন";
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
      const sentToEl = document.getElementById("otpSentTo");
      if (sentToEl) {
        sentToEl.textContent = pendingPhone + " নাম্বারে একটি কোড পাঠানো হয়েছে";
      }
      showStep(stepOtp);
    })
    .catch((error) => {
      console.error("Firebase Auth Error:", error);
      if (errEl) {
        errEl.textContent = "OTP পাঠানো যায়নি, আবার চেষ্টা করুন";
      }
      // Reset reCAPTCHA on error
      if (window.grecaptcha && window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then((widgetId) => {
          grecaptcha.reset(widgetId);
        });
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
  if (errEl) errEl.textContent = "";

  if (code.length < 6) {
    if (errEl) errEl.textContent = "৬ ডিজিটের কোডটি সম্পূর্ণ দিন";
    return;
  }
  if (!confirmationResult) {
    if (errEl) errEl.textContent = "আবার OTP পাঠান";
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
      console.error("Verification Error:", error);
      showStep(stepOtp);
      if (errEl) errEl.textContent = "কোডটি সঠিক নয়, আবার চেষ্টা করুন";
    });
    }

