const bodyEl = document.getElementById("reservation-table-body");
const statusEl = document.getElementById("reservations-status");
const dateFilterEl = document.getElementById("reservation-date-filter");

const SEAT_TYPE_LABEL = { booth: "Booth", chair: "Table", stool: "Stool" };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

dateFilterEl.value = todayISO();

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status-msg show ${type}`;
}

function formatTime12h(hhmm) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

async function loadReservations() {
  try {
    const res = await fetch(`/api/reservations?date=${encodeURIComponent(dateFilterEl.value)}`);
    const reservations = await res.json();
    render(reservations);
  } catch {
    bodyEl.innerHTML = `<tr><td colspan="6" class="empty-note">Couldn't load reservations right now.</td></tr>`;
    showStatus("Couldn't load reservations right now. Check your connection and reload.", "error");
  }
}

function render(reservations) {
  if (!reservations.length) {
    bodyEl.innerHTML = `<tr><td colspan="6" class="empty-note">No reservations for this date.</td></tr>`;
    return;
  }

  bodyEl.innerHTML = reservations.map(renderRow).join("");

  bodyEl.querySelectorAll("button[data-delete-reservation]").forEach((btn) => {
    btn.addEventListener("click", () => deleteReservation(btn.dataset.deleteReservation));
  });
}

function renderRow(reservation) {
  const seatLabel = `${SEAT_TYPE_LABEL[reservation.seatType] || "Seat"} #${reservation.seatNumber}`;
  return `
    <tr>
      <td>${formatTime12h(reservation.time)}</td>
      <td>${escapeHtml(seatLabel)}</td>
      <td>${escapeHtml(reservation.name)}</td>
      <td>${escapeHtml(reservation.phone)}</td>
      <td>${reservation.partySize}</td>
      <td><button type="button" class="secondary" data-delete-reservation="${reservation.id}">Cancel</button></td>
    </tr>
  `;
}

async function deleteReservation(id) {
  if (!confirm("Cancel this reservation? This can't be undone.")) return;
  try {
    const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't cancel that reservation.", "error");
      return;
    }
    loadReservations();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

dateFilterEl.addEventListener("change", loadReservations);

loadReservations();
