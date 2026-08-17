const formEl = document.getElementById("login-form");
const statusEl = document.getElementById("login-status");

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
