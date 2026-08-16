const listEl = document.getElementById("event-list");
const formEl = document.getElementById("event-form");
const statusEl = document.getElementById("event-status");

async function loadEvents() {
  try {
    const res = await fetch("/api/events");
    const events = await res.json();
    renderEvents(events);
  } catch {
    listEl.innerHTML = `<li class="empty-note">Couldn't load events right now.</li>`;
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
          <span class="event-date">${event.eventDate}${event.startTime ? ` &middot; ${event.startTime}` : ""}</span>
        </li>
      `
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status-msg show ${type}`;
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(formEl);
  const title = String(data.get("title") || "").trim();
  const payload = {
    title,
    eventDate: String(data.get("eventDate") || ""),
    startTime: String(data.get("startTime") || "") || undefined,
    coverCharge: Number(data.get("coverCharge") || 0),
  };

  const submitBtn = formEl.querySelector("button");
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      showStatus(result.error || "Couldn't add that event.", "error");
      return;
    }
    showStatus(`"${title}" added to the calendar!`, "success");
    formEl.reset();
    loadEvents();
  } catch {
    showStatus("Something went wrong adding that event.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

loadEvents();
