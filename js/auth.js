let confirmationResult = null;
let pendingPhone = "";
let pendingName = "";

const stepPhone = document.getElementById("step-phone");
const stepName = document.getElementById("step-name");
const stepOtp = document.getElementById("step-otp");
const stepLoad = document.getElementById("step-loading");

function showStep(step) {
    [stepPhone, stepName, stepOtp, stepLoad].forEach((s) => {
        if (s) s.classList.add("hidden");
    });

    if (step) {
        step.classList.remove("hidden");
    }
}

function backTo(which) {
    if (which === "phone") {
        showStep(stepPhone);
    }
}

// ------------------------------
// Persistent Login
// ------------------------------

auth.onAuthStateChanged(async (user) => {

    if (user) {

        showStep(stepLoad);

        try {

            const doc = await db
                .collection("users")
                .doc(user.uid)
                .get();

            if (doc.exists && doc.data().name) {
                window.location.replace(
                    "home.html"
                );
                return;
            }

        } catch (e) {
            console.log(e);
        }

        showStep(stepPhone);

    } else {

        showStep(stepPhone);
    }
});

// ------------------------------
// Step 1
// ------------------------------

function goToNameStep() {

    const num =
        document.getElementById(
            "phoneInput"
        ).value.trim();

    const errEl =
        document.getElementById(
            "err-phone"
        );

    errEl.textContent = "";

    if (!num || num.length < 10) {

        errEl.textContent =
            "সঠিক মোবাইল নাম্বার দিন";

        return;
    }

    const cleanNum =
        num
        .replace(/\D
