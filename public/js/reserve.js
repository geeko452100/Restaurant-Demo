const formEl = document.getElementById("reserve-form");
const statusEl = document.getElementById("reserve-status");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const partySizeInput = document.getElementById("partySize");
const seatGridEl = document.getElementById("seat-grid");
const seatNumberInput = document.getElementById("seatNumber");

const SEAT_TYPE_LABEL = { booth: "Booth", chair: "Table", stool: "Stool" };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Coming from an event card's "Reserve a table for <event>" link pre-fills
// that event's date; otherwise default to today.
const requestedDate = new URLSearchParams(window.location.search).get("date");
dateInput.min = todayISO();
dateInput.value = requestedDate && requestedDate >= dateInput.min ? requestedDate : todayISO();

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status-msg show ${type}`;
}

function selectSeat(seatNumber, tileEl) {
  seatNumberInput.value = seatNumber;
  seatGridEl.querySelectorAll(".seat-tile.is-selected").forEach((el) => el.classList.remove("is-selected"));
  tileEl.classList.add("is-selected");
}

function renderSeatGrid(layout, bookedSeatNumbers) {
  const partySize = Number(partySizeInput.value) || 1;
  const selectedSeatNumber = seatNumberInput.value ? Number(seatNumberInput.value) : null;
  let selectedStillAvailable = false;

  seatGridEl.innerHTML = "";
  layout.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "seat-row";
    row.forEach((seat) => {
      const tileEl = document.createElement("div");
      if (!seat) {
        tileEl.className = "seat-tile is-empty";
        rowEl.appendChild(tileEl);
        return;
      }

      const isBooked = bookedSeatNumbers.includes(seat.number);
      const isTooSmall = seat.capacity < partySize;
      tileEl.className = `seat-tile${isBooked || isTooSmall ? " is-disabled" : ""}`;
      tileEl.innerHTML = `<span class="seat-tile-type">${SEAT_TYPE_LABEL[seat.type]}</span><span>#${seat.number}</span>`;
      tileEl.title = isBooked ? "Booked for this time" : `Seats up to ${seat.capacity}`;

      if (!isBooked && !isTooSmall) {
        if (seat.number === selectedSeatNumber) {
          tileEl.classList.add("is-selected");
          selectedStillAvailable = true;
        }
        tileEl.addEventListener("click", () => selectSeat(seat.number, tileEl));
      }

      rowEl.appendChild(tileEl);
    });
    seatGridEl.appendChild(rowEl);
  });

  if (!selectedStillAvailable) seatNumberInput.value = "";
}

async function loadSeatGrid() {
  const date = dateInput.value;
  const time = timeInput.value;
  if (!date || !time) {
    seatGridEl.innerHTML = `<p class="empty-note">Choose a date, time, and party size to see available seats.</p>`;
    seatNumberInput.value = "";
    return;
  }

  seatGridEl.innerHTML = `<p class="empty-note">Loading seats...</p>`;
  try {
    const res = await fetch(`/api/reservations/availability?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`);
    const data = await res.json();
    if (!res.ok) {
      seatGridEl.innerHTML = `<p class="empty-note">${data.error || "Couldn't load seats right now."}</p>`;
      return;
    }
    renderSeatGrid(data.layout, data.bookedSeatNumbers);
  } catch {
    seatGridEl.innerHTML = `<p class="empty-note">Couldn't load seats right now. Check your connection.</p>`;
  }
}

[dateInput, timeInput, partySizeInput].forEach((el) => el.addEventListener("change", loadSeatGrid));
loadSeatGrid();

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const date = dateInput.value;
  const partySize = partySizeInput.value;
  const time = timeInput.value;
  const seatNumber = seatNumberInput.value;

  if (!seatNumber) {
    showStatus("Please pick a seat on the floor plan.", "error");
    return;
  }

  const submitBtn = formEl.querySelector("button");
  submitBtn.disabled = true;
  showStatus("Booking...", "info");

  try {
    const res = await fetch("/api/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, date, partySize, time, seatNumber }),
    });
    const data = await res.json();

    if (!res.ok) {
      showStatus(data.error || "Couldn't make the reservation.", "error");
      return;
    }

    if (!data.ok) {
      showStatus(data.error || "That seat just got booked. Please pick another.", "error");
      loadSeatGrid();
      return;
    }

    showStatus("✓ See you then!", "success");
  } catch {
    showStatus("Something went wrong. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
