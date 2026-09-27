const boardEl = document.getElementById("order-board");
const statsEl = document.getElementById("order-stats");
const statusEl = document.getElementById("orders-status");
const filterTabs = document.querySelectorAll(".filter-tabs button");

const OPEN_STATUSES = ["New", "Preparing", "Ready"];
const NEXT_STEP = {
  New: { status: "Preparing", label: "Start Preparing" },
  Preparing: { status: "Ready", label: "Mark Ready" },
  Ready: { status: "Completed", label: "Picked Up" },
};

let orders = [];
let filter = "open";
let seenOrderIds = null; // null until the first load, so existing orders don't "ding"
const baseTitle = document.title;

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status-msg show ${type}`;
}

function money(amount) {
  return `$${amount.toFixed(2)}`;
}

function formatTime12h(hhmm) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

// created_at is a UTC "YYYY-MM-DD HH:MM:SS" string from SQLite.
function placedAt(order) {
  const date = new Date(`${order.createdAt.replace(" ", "T")}Z`);
  const time = date.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
  const minutesAgo = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  const ago = minutesAgo < 1 ? "just now" : minutesAgo < 90 ? `${minutesAgo} min ago` : "";
  return ago ? `${time} (${ago})` : time;
}

async function loadOrders() {
  try {
    const res = await fetch("/api/orders");
    if (!res.ok) throw new Error();
    orders = await res.json();
    announceNewOrders();
    renderStats();
    renderBoard();
  } catch {
    showStatus("Couldn't load orders right now. Retrying...", "error");
  }
}

function announceNewOrders() {
  const ids = new Set(orders.map((o) => o.id));
  if (seenOrderIds) {
    const fresh = orders.filter((o) => !seenOrderIds.has(o.id) && o.status === "New");
    if (fresh.length) {
      const names = fresh.map((o) => `#${o.id} (${o.customerName})`).join(", ");
      showStatus(`New order${fresh.length > 1 ? "s" : ""}: ${names}`, "info");
    }
  }
  seenOrderIds = ids;
  const newCount = orders.filter((o) => o.status === "New").length;
  document.title = newCount ? `(${newCount}) ${baseTitle}` : baseTitle;
}

function renderStats() {
  const live = orders.filter((o) => o.status !== "Cancelled");
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status));
  const unpaid = live.filter((o) => o.paymentStatus === "Unpaid");
  const paid = live.filter((o) => o.paymentStatus === "Paid");
  const sum = (list) => list.reduce((total, o) => total + o.total, 0);
  const cash = sum(paid.filter((o) => o.paymentMethod === "Cash"));
  const card = sum(paid.filter((o) => o.paymentMethod === "Card"));

  statsEl.innerHTML = [
    { value: open.length, label: "Open orders" },
    { value: money(sum(unpaid)), label: `Awaiting payment (${unpaid.length})` },
    { value: money(sum(paid)), label: "Collected today" },
    { value: `${money(cash)} / ${money(card)}`, label: "Cash / Card" },
  ]
    .map((s) => `<div class="stat-tile"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`)
    .join("");
}

function visibleOrders() {
  if (filter === "open") {
    // Kitchen works oldest-first.
    return orders.filter((o) => OPEN_STATUSES.includes(o.status)).reverse();
  }
  if (filter === "unpaid") return orders.filter((o) => o.paymentStatus === "Unpaid" && o.status !== "Cancelled");
  return orders;
}

function renderBoard() {
  const list = visibleOrders();
  if (!list.length) {
    const empty = { open: "No open orders. Nice and quiet.", unpaid: "Everything's paid up.", all: "No orders yet today." };
    boardEl.innerHTML = `<p class="empty-note">${empty[filter]}</p>`;
    return;
  }
  boardEl.innerHTML = list.map(renderTicket).join("");
}

function renderTicket(order) {
  const isOpen = OPEN_STATUSES.includes(order.status);
  const isPaid = order.paymentStatus === "Paid";
  const ticketClass = isOpen ? `is-${order.status.toLowerCase()}` : "is-closed";
  const next = NEXT_STEP[order.status];
  const pickedUpBlocked = next?.status === "Completed" && !isPaid;

  const actions = [];
  if (!isPaid && order.status !== "Cancelled") {
    actions.push(`<button type="button" data-pay="Cash" data-order="${order.id}">Collect Cash</button>`);
    actions.push(`<button type="button" data-pay="Card" data-order="${order.id}">Collect Card</button>`);
  }
  if (next) {
    actions.push(
      `<button type="button" class="secondary" data-status="${next.status}" data-order="${order.id}"${
        pickedUpBlocked ? ` disabled title="Collect payment first"` : ""
      }>${next.label}</button>`
    );
  }
  if (isOpen) {
    actions.push(`<button type="button" class="secondary" data-status="Cancelled" data-order="${order.id}">Cancel</button>`);
  }

  const payment = isPaid
    ? `<span class="status-pill is-paid">Paid &middot; ${escapeHtml(order.paymentMethod || "")}</span>`
    : order.status === "Cancelled"
      ? ""
      : `<span class="status-pill is-unpaid">Unpaid</span>`;

  return `
    <article class="order-ticket ${ticketClass}">
      <div class="order-ticket-header">
        <div>
          <div class="order-ticket-number">#${order.id} &middot; ${escapeHtml(order.customerName)}</div>
          <div class="order-ticket-meta">
            Placed ${placedAt(order)} &middot; Pickup ${order.pickupTime ? formatTime12h(order.pickupTime) : "ASAP"}
            &middot; <a href="tel:${escapeAttr(order.phone)}" class="text-muted">${escapeHtml(order.phone)}</a>
          </div>
        </div>
        <span class="status-pill is-${order.status.toLowerCase()}">${order.status === "Completed" ? "Picked Up" : order.status}</span>
      </div>
      <ul class="order-ticket-items">
        ${order.items
          .map((item) => `<li><span>${item.quantity} &times; ${escapeHtml(item.name)}</span><span>${money(item.unitPrice * item.quantity)}</span></li>`)
          .join("")}
      </ul>
      ${order.notes ? `<p class="order-ticket-notes">&ldquo;${escapeHtml(order.notes)}&rdquo;</p>` : ""}
      <div class="order-ticket-footer">
        <span class="beer-price">${money(order.total)} <span class="text-muted text-xs font-normal">incl. ${money(order.tax)} tax</span></span>
        ${payment}
      </div>
      ${actions.length ? `<div class="order-ticket-actions">${actions.join("")}</div>` : ""}
    </article>
  `;
}

async function updateStatus(id, status) {
  if (status === "Cancelled" && !confirm(`Cancel order #${id}?`)) return;
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't update that order.", "error");
    }
    loadOrders();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

async function collectPayment(id, method) {
  const order = orders.find((o) => o.id === id);
  if (!order) return;

  let changeDue = null;
  if (method === "Cash") {
    const tendered = prompt(`Order #${id} total is ${money(order.total)}. Cash received?`, order.total.toFixed(2));
    if (tendered == null) return;
    const amount = Number(tendered.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount < order.total) {
      showStatus(`Cash received has to be at least ${money(order.total)}.`, "error");
      return;
    }
    changeDue = Math.round((amount - order.total) * 100) / 100;
  } else if (!confirm(`Run ${money(order.total)} on card for order #${id}?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/orders/${id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showStatus(data.error || "Couldn't record that payment.", "error");
    } else {
      const change = changeDue ? ` Change due: ${money(changeDue)}.` : "";
      showStatus(`Order #${id} paid by ${method.toLowerCase()}.${change}`, "success");
    }
    loadOrders();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

boardEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-order]");
  if (!btn || btn.disabled) return;
  const id = Number(btn.dataset.order);
  if (btn.dataset.pay) collectPayment(id, btn.dataset.pay);
  else if (btn.dataset.status) updateStatus(id, btn.dataset.status);
});

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    filter = tab.dataset.filter;
    filterTabs.forEach((t) => t.classList.toggle("is-active", t === tab));
    renderBoard();
  });
});

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadOrders();
setInterval(loadOrders, 5000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadOrders();
});
