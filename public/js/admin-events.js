const listEl = document.getElementById("event-list");
const formEl = document.getElementById("event-form");
const statusEl = document.getElementById("event-status");
const formTitleEl = document.getElementById("event-form-title");
const submitBtnEl = document.getElementById("event-form-submit");
const cancelBtnEl = document.getElementById("event-form-cancel");

let currentEvents = [];

async function loadEvents() {
  try {
    const res = await fetch("/api/events");
    const events = await res.json();
    currentEvents = events;
    renderEvents(events);
  } catch {
    listEl.innerHTML = `<li class="empty-note">Couldn't load events right now.</li>`;
    showStatus("Couldn't load events right now. Check your connection and reload.", "error");
  }
}

function renderEvents(events) {
  if (!events.length) {
    listEl.innerHTML = `<li class="empty-note">Nothing on the calendar yet.</li>`;
    return;
  }

  listEl.innerHTML = events
    .map(
      (event) => `
        <li>
          <span>${escapeHtml(event.title)}</span>
          <span class="flex items-center gap-2">
            <span class="event-date">${event.eventDate}${event.startTime ? ` &middot; ${formatTime12h(event.startTime)}` : ""}</span>
            <button type="button" class="secondary" data-edit-event="${event.id}">Edit</button>
            <button type="button" class="secondary" data-delete-event="${event.id}">Delete</button>
          </span>
        </li>
      `
    )
    .join("");

  listEl.querySelectorAll("button[data-edit-event]").forEach((btn) => {
    btn.addEventListener("click", () => startEditEvent(btn.dataset.editEvent));
  });
  listEl.querySelectorAll("button[data-delete-event]").forEach((btn) => {
    btn.addEventListener("click", () => deleteEvent(btn.dataset.deleteEvent));
  });
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

function startEditEvent(id) {
  const event = currentEvents.find((e) => String(e.id) === String(id));
  if (!event) return;

  formEl.eventId.value = event.id;
  formEl.title.value = event.title;
  formEl.eventDate.value = event.eventDate;
  formEl.startTime.value = event.startTime || "";
  formEl.coverCharge.value = event.coverCharge;

  formTitleEl.textContent = `Edit "${event.title}"`;
  submitBtnEl.textContent = "Save Changes";
  cancelBtnEl.classList.remove("hidden");
  formEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  formEl.reset();
  formEl.eventId.value = "";
  formTitleEl.textContent = "Add a Show";
  submitBtnEl.textContent = "Add to Calendar";
  cancelBtnEl.classList.add("hidden");
}

cancelBtnEl.addEventListener("click", resetForm);

async function deleteEvent(id) {
  if (!confirm("Delete this event? This can't be undone.")) return;
  try {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't delete that event.", "error");
      return;
    }
    loadEvents();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

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
    showStatus(`"${title}" saved!`, "success");
    resetForm();
    loadEvents();
  } catch {
    showStatus("Something went wrong saving that event.", "error");
  } finally {
    submitBtnEl.disabled = false;
  }
});

loadEvents();
