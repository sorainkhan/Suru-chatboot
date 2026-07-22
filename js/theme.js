(function () {
  const saved = localStorage.getItem("suru_theme") || "light";
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

function setTheme(mode) {
  localStorage.setItem("suru_theme", mode);
  if (mode === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const dBtn = document.getElementById("themeDarkBtn");
  const lBtn = document.getElementById("themeLightBtn");
  if (dBtn && lBtn) {
    dBtn.classList.toggle("active", mode === "dark");
    lBtn.classList.toggle("active", mode === "light");
  }
}
