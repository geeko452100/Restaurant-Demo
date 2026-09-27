const gridEl = document.getElementById("event-grid");
const heroTitleEl = document.getElementById("special-events-title");
const heroSubtitleEl = document.getElementById("special-events-subtitle");

async function loadEvents() {
  try {
    const res = await fetch("/api/events");
    const events = await res.json();
    renderEvents(events);
    renderHero(events);
  } catch {
    gridEl.innerHTML = `<p class="empty-note">Couldn't load events right now.</p>`;
    renderHero([]);
  }
}

function renderHero(events) {
  if (!heroTitleEl || !heroSubtitleEl) return;

  const next = events[0];
  if (!next) {
    heroTitleEl.textContent = "More Special Events Coming Soon";
    heroSubtitleEl.textContent = "Tasting nights, cook-offs, and seasonal dinners are on the way. Check back soon.";
    return;
  }

  const when = [formatDate(next.eventDate), next.startTime && formatTime12h(next.startTime), priceLabel(next)]
    .filter(Boolean)
    .join(" &middot; ");
  heroTitleEl.textContent = next.title;
  heroSubtitleEl.innerHTML = `${when}${next.description ? ` &mdash; ${escapeHtml(next.description)}` : ""}`;
}

// Most entries are specials with the deal in the description, so a $0
// price just isn't shown rather than reading as "Free".
function priceLabel(event) {
  return event.coverCharge > 0 ? `$${event.coverCharge.toFixed(2)} per person` : "";
}

function renderEvents(events) {
  if (!events.length) {
    gridEl.innerHTML = `<p class="empty-note">No upcoming events yet &mdash; check back soon.</p>`;
    return;
  }

  gridEl.innerHTML = events
    .map((event) => {
      const details = [event.startTime && `Starts ${formatTime12h(event.startTime)}`, priceLabel(event)]
        .filter(Boolean)
        .join(" &middot; ");
      return `
        <a class="event-card" href="reserve.html?date=${encodeURIComponent(event.eventDate)}" title="Reserve a table for ${escapeAttr(event.title)}">
          <div class="event-date">${formatDate(event.eventDate)}</div>
          <div class="beer-name">${escapeHtml(event.title)}</div>
          ${event.description ? `<p class="beer-style m-0 mt-1">${escapeHtml(event.description)}</p>` : ""}
          ${details ? `<div class="event-cover">${details}</div>` : ""}
        </a>
      `;
    })
    .join("");
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime12h(hhmm) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

loadEvents();
