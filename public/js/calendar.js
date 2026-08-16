const listEl = document.getElementById("week-list");

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Sunday through Saturday of the current week.
function currentWeekDates() {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push(d);
  }
  return days;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadWeek() {
  try {
    const res = await fetch("/api/events");
    const events = await res.json();
    renderWeek(events);
  } catch {
    listEl.innerHTML = `<li class="empty-note">Couldn't load this week's schedule right now.</li>`;
  }
}

function renderWeek(events) {
  const todayISO = toISO(new Date());
  const eventsByDate = new Map();
  for (const event of events) {
    if (!eventsByDate.has(event.eventDate)) eventsByDate.set(event.eventDate, []);
    eventsByDate.get(event.eventDate).push(event);
  }

  listEl.innerHTML = currentWeekDates()
    .map((date) => {
      const iso = toISO(date);
      const isToday = iso === todayISO;
      const dayEvents = eventsByDate.get(iso) || [];
      const label = date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

      const body = dayEvents.length
        ? dayEvents
            .map(
              (event) => `
                <a class="week-day-event" href="reserve.html?date=${encodeURIComponent(iso)}">
                  ${escapeHtml(event.title)}${event.startTime ? ` &middot; ${event.startTime}` : ""}
                </a>
              `
            )
            .join("")
        : `<span class="week-day-empty">No event scheduled</span>`;

      return `
        <li class="week-day${isToday ? " is-today" : ""}">
          <span class="week-day-label">${label}${isToday ? " &middot; Today" : ""}</span>
          <span class="week-day-body">${body}</span>
        </li>
      `;
    })
    .join("");
}

loadWeek();
