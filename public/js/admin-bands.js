const bodyEl = document.getElementById("band-table-body");

async function loadApplications() {
  try {
    const res = await fetch("/api/bands");
    const applications = await res.json();
    render(applications);
  } catch {
    bodyEl.innerHTML = `<tr><td colspan="7" class="empty-note">Couldn't load applications right now.</td></tr>`;
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
  if (app.status !== "approved") {
    actions.push(`<button type="button" data-id="${app.id}" data-status="approved">Approve</button>`);
  }
  if (app.status !== "archived") {
    actions.push(`<button type="button" class="secondary" data-id="${app.id}" data-status="archived">Archive</button>`);
  }
  if (app.status !== "pending") {
    actions.push(`<button type="button" class="secondary" data-id="${app.id}" data-status="pending">Reset</button>`);
  }

  return `
    <tr>
      <td>${escapeHtml(app.bandName)}</td>
      <td>${escapeHtml(app.genre)}</td>
      <td>${rate}</td>
      <td>${escapeHtml(app.email)}</td>
      <td><a href="${escapeAttr(app.mediaLink)}" target="_blank" rel="noopener noreferrer" class="text-brand-bright">Listen</a></td>
      <td><span class="status-pill ${app.status}">${app.status}</span></td>
      <td><div class="flex gap-1.5 flex-wrap">${actions.join("")}</div></td>
    </tr>
  `;
}

async function setStatus(id, status) {
  await fetch(`/api/bands/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  loadApplications();
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
