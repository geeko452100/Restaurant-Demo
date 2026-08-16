(async function () {
  const res = await fetch("/api/auth/me").catch(() => null);
  const data = res ? await res.json().catch(() => ({ authenticated: false })) : { authenticated: false };

  if (!data.authenticated) {
    const callbackUrl = encodeURIComponent(window.location.pathname);
    window.location.replace(`/admin/login.html?callbackUrl=${callbackUrl}`);
    return;
  }

  document.body.classList.remove("admin-guard-hidden");

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/admin/login.html";
    });
  }

  const path = window.location.pathname.replace(/\/$/, "");
  document.querySelectorAll(".site-nav a").forEach((link) => {
    const linkPath = new URL(link.href).pathname.replace(/\/$/, "");
    if (linkPath === path) link.classList.add("active");
  });
})();
