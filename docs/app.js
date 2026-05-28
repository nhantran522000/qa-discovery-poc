// Minimal client behaviour for the Bramblewood Care sample app.
// Kept deliberately simple so the accessibility snapshot stays deterministic.

document.addEventListener("DOMContentLoaded", () => {
  // Login form: prevent real submission, route to the dashboard.
  const loginForm = document.querySelector("[data-login-form]");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      window.location.href = "dashboard.html";
    });
  }

  // Settings toggles: reflect pressed state for assistive tech.
  document.querySelectorAll("[role='switch']").forEach((sw) => {
    sw.addEventListener("click", () => {
      const on = sw.getAttribute("aria-checked") === "true";
      sw.setAttribute("aria-checked", String(!on));
    });
  });

  // Profile edit button: toggle a lightweight notice (no real editing).
  const editBtn = document.querySelector("[data-edit-profile]");
  const editNotice = document.querySelector("[data-edit-notice]");
  if (editBtn && editNotice) {
    editBtn.addEventListener("click", () => {
      editNotice.hidden = !editNotice.hidden;
    });
  }
});
