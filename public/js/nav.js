(function () {
  const toggle = document.querySelector(".mobile-nav-toggle");
  const panel = document.querySelector(".mobile-nav-panel");
  if (!toggle || !panel) return;

  // The button is only visually present below the `md` breakpoint (see
  // `.mobile-nav-toggle { @apply md:hidden }` in input.css) — keep
  // aria-hidden in sync so screen readers see it exactly when sighted
  // users do, instead of the static `aria-hidden="true"` hiding it on
  // mobile too.
  const mobileQuery = window.matchMedia("(max-width: 767px)");
  function syncAriaHidden() {
    toggle.setAttribute("aria-hidden", mobileQuery.matches ? "false" : "true");
  }
  syncAriaHidden();
  mobileQuery.addEventListener("change", syncAriaHidden);

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("show");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.textContent = isOpen ? "✕" : "☰";
  });

  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      panel.classList.remove("show");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "☰";
    });
  });

  const path = window.location.pathname.replace(/\/$/, "") || "/index.html";
  document.querySelectorAll(".site-nav a, .mobile-nav-panel a").forEach((link) => {
    const linkPath = new URL(link.href).pathname.replace(/\/$/, "") || "/index.html";
    if (linkPath === path) link.classList.add("active");
  });
})();
