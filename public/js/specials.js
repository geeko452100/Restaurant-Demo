const rootEl = document.getElementById("specials-root");

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The restaurant runs on Central Time, so "today" is Chicago's today no
// matter where the visitor's browser is.
function centralDayOfWeek() {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long" }).format(new Date());
  return DAY_NAMES.indexOf(weekday);
}

async function loadSpecials() {
  try {
    const res = await fetch("/api/menu");
    const menu = await res.json();
    renderSpecials(menu.flatMap((category) => category.items).filter((item) => item.dayOfWeek != null));
  } catch {
    rootEl.innerHTML = `<p class="empty-note">Couldn't load the specials right now.</p>`;
  }
}

function renderSpecials(specials) {
  const today = centralDayOfWeek();
  const todays = specials.filter((item) => item.dayOfWeek === today);

  const todayCard = `
    <section class="card">
      <h2>Today&apos;s Special</h2>
      ${
        todays.length
          ? `<div class="menu-grid">${todays.map(renderItemCard).join("")}</div>
             <div class="header-actions justify-start"><a href="/order" class="btn">Order Online</a></div>`
          : `<p class="empty-note">No special today. Check back tomorrow, or see the full week below.</p>`
      }
    </section>
  `;

  // Start the week at Monday; Sunday goes last.
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekCard = `
    <section class="card">
      <h2>This Week</h2>
      <ul class="week-list">
        ${weekOrder
          .map((dayOfWeek) => {
            const items = specials.filter((item) => item.dayOfWeek === dayOfWeek);
            const body = items.length
              ? items
                  .map(
                    (item) => `
                      <span class="week-day-event">${escapeHtml(item.name)} &middot; $${item.price.toFixed(2)}${item.isAvailable ? "" : " (86'd)"}</span>
                      ${item.description ? `<span class="beer-style">${escapeHtml(item.description)}</span>` : ""}`
                  )
                  .join("")
              : `<span class="week-day-empty">No special</span>`;
            return `
              <li class="week-day${dayOfWeek === today ? " is-today" : ""}">
                <span class="week-day-label">${DAY_NAMES[dayOfWeek]}${dayOfWeek === today ? " &middot; Today" : ""}</span>
                <div class="week-day-body flex-1">${body}</div>
              </li>`;
          })
          .join("")}
      </ul>
    </section>
  `;

  rootEl.innerHTML = todayCard + weekCard;
}

function renderItemCard(item) {
  const cardClass = item.isAvailable ? "menu-item-card" : "menu-item-card is-sold-out";
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
      <p class="beer-style m-0">${escapeHtml(item.description || "")}</p>
      <div class="menu-item-card-footer">
        <span class="badge ${item.isAvailable ? "on-tap" : "sold-out"}">${item.isAvailable ? "Available" : "86'd"}</span>
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

loadSpecials();
// Poll like the menu pages so an 86'd special shows without a refresh.
setInterval(loadSpecials, 4000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadSpecials();
});
