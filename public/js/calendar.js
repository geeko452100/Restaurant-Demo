const gridEl = document.getElementById("calendar-grid");
const monthLabelEl = document.getElementById("calendar-month-label");
const prevBtn = document.getElementById("calendar-prev");
const nextBtn = document.getElementById("calendar-next");
const adminBarEl = document.getElementById("calendar-admin-bar");

const formEl = document.getElementById("event-form");
const formTitleEl = document.getElementById("event-form-title");
const submitBtnEl = document.getElementById("event-form-submit");
const deleteBtnEl = document.getElementById("event-form-delete");
const cancelBtnEl = document.getElementById("event-form-cancel");
const statusEl = document.getElementById("event-form-status");

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let isAdmin = false;
let events = [];
let viewDate = startOfMonth(new Date());

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatTime12h(hhmm) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status-msg show ${type}`;
}

async function checkAdmin() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    isAdmin = Boolean(data.authenticated);
  } catch {
    isAdmin = false;
  }
  adminBarEl.classList.toggle("hidden", !isAdmin);
}

async function loadEvents() {
  try {
    const res = await fetch("/api/events");
    events = await res.json();
  } catch {
    events = null;
  }
  renderCalendar();
}

function renderCalendar() {
  monthLabelEl.textContent = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  if (events === null) {
    gridEl.innerHTML = `<p class="empty-note">Couldn't load the calendar right now.</p>`;
    return;
  }

  const eventsByDate = new Map();
  for (const event of events) {
    if (!eventsByDate.has(event.eventDate)) eventsByDate.set(event.eventDate, []);
    eventsByDate.get(event.eventDate).push(event);
  }

  const todayISO = toISO(new Date());
  const monthIndex = viewDate.getMonth();
  const gridStart = new Date(viewDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const weekdayHeaders = WEEKDAY_LABELS.map((label) => `<div class="calendar-weekday">${label}</div>`).join("");

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    const iso = toISO(cellDate);
    const isOtherMonth = cellDate.getMonth() !== monthIndex;
    const isToday = iso === todayISO;
    const dayEvents = eventsByDate.get(iso) || [];

    const classes = ["calendar-day"];
    if (isOtherMonth) classes.push("is-other-month");
    if (isToday) classes.push("is-today");
    if (isAdmin) classes.push("is-admin-editable");

    const chips = dayEvents
      .map((event) => {
        const label = `${escapeHtml(event.title)}${event.startTime ? ` &middot; ${formatTime12h(event.startTime)}` : ""}`;
        return isAdmin
          ? `<button type="button" class="calendar-event-chip" data-edit-event="${event.id}">${label}</button>`
          : `<a class="calendar-event-chip" href="/reserve?date=${encodeURIComponent(iso)}">${label}</a>`;
      })
      .join("");

    cells.push(`
      <div class="${classes.join(" ")}" ${isAdmin ? `data-add-date="${iso}"` : ""}>
        <span class="calendar-day-number">${cellDate.getDate()}</span>
        <div class="calendar-day-events">${chips}</div>
      </div>
    `);
  }

  gridEl.innerHTML = weekdayHeaders + cells.join("");

  if (isAdmin) {
    gridEl.querySelectorAll("[data-add-date]").forEach((cell) => {
      cell.addEventListener("click", (e) => {
        if (e.target.closest("[data-edit-event]")) return;
        openForm({ eventDate: cell.dataset.addDate });
      });
    });
    gridEl.querySelectorAll("[data-edit-event]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const event = events.find((ev) => String(ev.id) === btn.dataset.editEvent);
        if (event) openForm(event);
      });
    });
  }
}

function openForm(event) {
  formEl.eventId.value = event.id || "";
  formEl.title.value = event.title || "";
  formEl.eventDate.value = event.eventDate || "";
  formEl.startTime.value = event.startTime || "";
  formEl.coverCharge.value = event.coverCharge ?? 0;
  formEl.description.value = event.description || "";

  formTitleEl.textContent = event.id ? `Edit "${event.title}"` : "Add a Show";
  submitBtnEl.textContent = event.id ? "Save Changes" : "Add to Calendar";
  deleteBtnEl.classList.toggle("hidden", !event.id);
  statusEl.className = "status-msg";
  formEl.classList.remove("hidden");
  formEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeForm() {
  formEl.reset();
  formEl.eventId.value = "";
  formEl.classList.add("hidden");
}

cancelBtnEl.addEventListener("click", closeForm);

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(formEl);
  const id = String(data.get("eventId") || "").trim();
  const title = String(data.get("title") || "").trim();
  const payload = {
    title,
    eventDate: String(data.get("eventDate") || ""),
    startTime: String(data.get("startTime") || "") || undefined,
    coverCharge: Number(data.get("coverCharge") || 0),
    description: String(data.get("description") || "").trim() || undefined,
  };

  submitBtnEl.disabled = true;
  try {
    const res = await fetch(id ? `/api/events/${id}` : "/api/events", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showStatus(result.error || "Couldn't save that event.", "error");
      return;
    }
    closeForm();
    loadEvents();
  } catch {
    showStatus("Something went wrong saving that event.", "error");
  } finally {
    submitBtnEl.disabled = false;
  }
});

deleteBtnEl.addEventListener("click", async () => {
  const id = formEl.eventId.value;
  if (!id) return;
  if (!confirm("Delete this event? This can't be undone.")) return;

  try {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't delete that event.", "error");
      return;
    }
    closeForm();
    loadEvents();
  } catch {
    showStatus("Something went wrong. Please try again.", "error");
  }
});

prevBtn.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  renderCalendar();
});
nextBtn.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  renderCalendar();
});

(async function init() {
  await checkAdmin();
  await loadEvents();
})();
