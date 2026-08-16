const rootEl = document.getElementById("menu-root");

async function loadMenu() {
  try {
    const res = await fetch("/api/menu");
    const menu = await res.json();
    renderMenu(menu);
  } catch {
    rootEl.innerHTML = `<p class="empty-note">Couldn't load the menu right now.</p>`;
  }
}

function renderMenu(menu) {
  if (!menu.length) {
    rootEl.innerHTML = `<p class="empty-note">Nothing on the menu yet.</p>`;
    return;
  }

  rootEl.innerHTML = menu
    .map((category) => {
      const items = category.items.length
        ? category.items.map(renderItem).join("")
        : `<p class="empty-note">Nothing here yet.</p>`;
      const banner = category.imageUrl
        ? `<div class="card-banner"><img src="${escapeAttr(category.imageUrl)}" alt="" loading="lazy" /></div>`
        : "";
      return `
        <section class="card">
          ${banner}
          <h2>${escapeHtml(category.name)}</h2>
          <ul class="beer-list">${items}</ul>
        </section>
      `;
    })
    .join("");
}

function renderItem(item) {
  const isBeverage = item.abv != null;
  const rowClass = item.isAvailable ? "beer-row" : "beer-row is-sold-out";
  const availabilityLabel = isBeverage
    ? item.isAvailable ? "On Tap" : "Sold Out"
    : item.isAvailable ? "Available" : "86'd";
  const availabilityClass = item.isAvailable ? "on-tap" : "sold-out";
  const abv = isBeverage ? ` &middot; ${item.abv}% ABV` : "";
  const badges = [
    item.isLocal ? `<span class="badge local">Local Brew</span>` : "",
    item.isGlutenFree ? `<span class="badge gluten-free">Gluten-Free</span>` : "",
  ].join("");

  return `
    <li class="${rowClass}">
      <div class="beer-main">
        ${itemThumb(item, isBeverage)}
        <div class="beer-info">
          <div class="beer-name">${escapeHtml(item.name)}</div>
          <div class="beer-style">${escapeHtml(item.description || "")}${abv}</div>
          ${badges ? `<div class="item-badges">${badges}</div>` : ""}
        </div>
      </div>
      <div class="beer-meta">
        <span class="beer-price">$${item.price.toFixed(2)}</span>
        <span class="badge ${availabilityClass}">${availabilityLabel}</span>
      </div>
    </li>
  `;
}

const BEER_GLASS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l-1 15a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 3Z"/><path d="M6.5 8H4a1 1 0 0 0-1 1v2a2 2 0 0 0 2 2h1.2"/><path d="M6 3c0 1.5 1 2 1.5 3S9 8 9 9"/></svg>`;
const PLATE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>`;

function itemThumb(item, isBeverage) {
  if (item.imageUrl) {
    return `<div class="item-thumb"><img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" /></div>`;
  }
  return `<div class="item-thumb">${isBeverage ? BEER_GLASS_ICON : PLATE_ICON}</div>`;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadMenu();
// Poll so the public menu updates automatically without a manual refresh.
setInterval(loadMenu, 4000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadMenu();
});
