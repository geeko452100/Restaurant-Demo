const bodyEl = document.getElementById("band-table-body");
const statusEl = document.getElementById("bands-status");

function showStatus(message, type) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-msg show ${type}`;
}

async function loadApplications() {
  try {
    const res = await fetch("/api/bands");
    const applications = await res.json();
    render(applications);
  } catch {
    bodyEl.innerHTML = `<tr><td colspan="7" class="empty-note">Couldn't load applications right now.</td></tr>`;
    showStatus("Couldn't load applications right now. Check your connection and reload.", "error");
  }
}

function render(applications) {
  if (!applications.length) {
    bodyEl.innerHTML = `<tr><td colspan="7" class="empty-note">No applications yet.</td></tr>`;
    return;
  }

  bodyEl.innerHTML = applications.map(renderRow).join("");

  bodyEl.querySelectorAll("button[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => setStatus(btn.dataset.id, btn.dataset.status));
  });
}

function renderRow(app) {
  const rate = app.rate != null ? `$${Number(app.rate).toFixed(0)}` : "&mdash;";
  const actions = [];
  if (app.status !== "Reviewed") {
    actions.push(`<button type="button" data-id="${app.id}" data-status="Reviewed">Mark Reviewed</button>`);
  }
  if (app.status !== "Booked") {
    actions.push(`<button type="button" data-id="${app.id}" data-status="Booked">Mark Booked</button>`);
  }
  if (app.status !== "Pending") {
    actions.push(`<button type="button" class="secondary" data-id="${app.id}" data-status="Pending">Reset</button>`);
  }

  return `
    <tr>
      <td>${escapeHtml(app.bandName)}</td>
      <td>${escapeHtml(app.genre)}</td>
      <td>${rate}</td>
      <td>${escapeHtml(app.email)}</td>
      <td><a href="${escapeAttr(app.mediaLink)}" target="_blank" rel="noopener noreferrer" class="text-brand-bright">Listen</a></td>
      <td><span class="status-pill ${app.status.toLowerCase()}">${app.status}</span></td>
      <td><div class="flex gap-1.5 flex-wrap">${actions.join("")}</div></td>
    </tr>
  `;
}

async function setStatus(id, status) {
  try {
    const res = await fetch(`/api/bands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't update that application.", "error");
      return;
    }
    loadApplications();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

loadApplications();
