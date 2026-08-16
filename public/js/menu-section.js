const rootEl = document.getElementById("menu-root");
const section = rootEl?.dataset.section; // "burgers" | "appetizers" | "drinks"

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
  const filtered = menu.filter((category) => category.section === section && category.items.length > 0);

  if (!filtered.length) {
    rootEl.innerHTML = `<p class="empty-note">Nothing here yet.</p>`;
    return;
  }

  rootEl.innerHTML = filtered
    .map(
      (category) => `
        <section class="card">
          <h2>${escapeHtml(category.name)}</h2>
          <div class="menu-grid">${category.items.map(renderItemCard).join("")}</div>
        </section>
      `
    )
    .join("");
}

function renderItemCard(item) {
  const isBeverage = item.abv != null;
  const cardClass = item.isAvailable ? "menu-item-card" : "menu-item-card is-sold-out";
  const availabilityLabel = isBeverage
    ? item.isAvailable ? "On Tap" : "Sold Out"
    : item.isAvailable ? "Available" : "86'd";
  const availabilityClass = item.isAvailable ? "on-tap" : "sold-out";
  const abv = isBeverage ? ` &middot; ${item.abv}% ABV` : "";
  const badges = [
    item.isLocal ? `<span class="badge local">Local Brew</span>` : "",
    item.isGlutenFree ? `<span class="badge gluten-free">Gluten-Free</span>` : "",
  ].join("");

  const media = item.imageUrl
    ? `<div class="menu-item-card-media"><img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" /></div>`
    : "";

  return `
    <div class="${cardClass}">
      ${media}
      <div class="menu-item-card-header">
        <span class="beer-name">${escapeHtml(item.name)}</span>
        <span class="beer-price">$${item.price.toFixed(2)}</span>
      </div>
      <p class="beer-style m-0">${escapeHtml(item.description || "")}${abv}</p>
      <div class="menu-item-card-footer">
        <span class="badge ${availabilityClass}">${availabilityLabel}</span>
        ${badges ? `<div class="item-badges">${badges}</div>` : ""}
      </div>
    </div>
  `;
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
