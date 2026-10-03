const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("password-toggle");

passwordToggle.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  passwordToggle.setAttribute("aria-pressed", String(!showing));
  passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  passwordInput.focus();
});

const formEl = document.getElementById("login-form");
const statusEl = document.getElementById("login-status");

// Demo site: pre-fill the seeded staff login (see src/db/seed.sql) and
// explain why in a popup on first visit.
const DEMO_EMAIL = "staff@example.com";
const DEMO_PASSWORD = "Password123!";

const demoDialog = document.getElementById("demo-dialog");
formEl.elements.email.value = DEMO_EMAIL;
passwordInput.value = DEMO_PASSWORD;
document.getElementById("demo-email").textContent = DEMO_EMAIL;
document.getElementById("demo-password").textContent = DEMO_PASSWORD;

document.getElementById("demo-dismiss").addEventListener("click", () => {
  demoDialog.close();
  formEl.querySelector("button[type=submit]").focus();
});
document.getElementById("demo-signin").addEventListener("click", () => {
  demoDialog.close();
  formEl.requestSubmit();
});
// Clicking the dimmed backdrop (outside the dialog box) closes it too.
demoDialog.addEventListener("click", (e) => {
  if (e.target === demoDialog) demoDialog.close();
});
demoDialog.showModal();

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(formEl);
  const submitBtn = formEl.querySelector("button");
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      statusEl.textContent = result.error || "Invalid email or password.";
      statusEl.className = "status-msg show error";
      return;
    }

    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("callbackUrl") || "/admin/index.html";
  } catch {
    statusEl.textContent = "Something went wrong. Please try again.";
    statusEl.className = "status-msg show error";
  } finally {
    submitBtn.disabled = false;
  }
});
