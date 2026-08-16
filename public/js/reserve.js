const formEl = document.getElementById("reserve-form");
const statusEl = document.getElementById("reserve-status");

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status-msg show ${type}`;
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const partySize = document.getElementById("partySize").value;
  const time = document.getElementById("time").value;

  const submitBtn = formEl.querySelector("button");
  submitBtn.disabled = true;
  showStatus("Sending confirmation...", "info");

  try {
    const res = await fetch("/api/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, partySize, time }),
    });
    const data = await res.json();

    if (!res.ok) {
      showStatus(data.error || "Couldn't send the confirmation text.", "error");
      return;
    }

    if (data.stub) {
      showStatus(
        `Reservation confirmed! (Text not sent - no carrier/email keys configured yet. Message would read: "${data.message}")`,
        "info"
      );
    } else {
      showStatus(`Reservation confirmed! A text was just sent to ${phone}.`, "success");
    }
  } catch {
    showStatus("Something went wrong. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
