const menuEl = document.getElementById("order-menu");
const builderEl = document.getElementById("order-builder");
const trackerEl = document.getElementById("order-tracker");
const cartEl = document.getElementById("cart");
const cartLinesEl = document.getElementById("cart-lines");
const cartTotalsEl = document.getElementById("cart-totals");
const cartBarEl = document.getElementById("cart-bar");
const cartBarCountEl = document.getElementById("cart-bar-count");
const checkoutForm = document.getElementById("checkout-form");
const checkoutStatusEl = document.getElementById("checkout-status");
const placeOrderBtn = document.getElementById("place-order-btn");
const pickupSelect = document.getElementById("pickupTime");

const CART_KEY = "rb-cart";
const ORDER_KEY = "rb-order";
const CLOSE_MINUTES = 23 * 60;

let orderableItems = new Map(); // menuItemId -> item
let taxRate = 0;
let cart = readStorage(CART_KEY) || {}; // { [menuItemId]: quantity }
let trackerTimer = null;

// localStorage can be missing or throw (private mode, blocked storage) —
// the page still works, the cart just won't survive a reload.
function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function showStatus(message, type) {
  checkoutStatusEl.textContent = message;
  checkoutStatusEl.className = `status-msg show ${type}`;
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

// Pickup slots are in the restaurant's Central Time, not the browser's.
function minutesNowCentral() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour").value) % 24;
  const minute = Number(parts.find((p) => p.type === "minute").value);
  return hour * 60 + minute;
}

function renderPickupSlots() {
  const selected = pickupSelect.value;
  const firstSlot = Math.ceil((minutesNowCentral() + 20) / 15) * 15;
  const options = [`<option value="">ASAP (about 20 minutes)</option>`];
  for (let t = firstSlot; t < CLOSE_MINUTES; t += 15) {
    const hhmm = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    options.push(`<option value="${hhmm}">${formatTime12h(hhmm)}</option>`);
  }
  pickupSelect.innerHTML = options.join("");
  if ([...pickupSelect.options].some((o) => o.value === selected)) pickupSelect.value = selected;
}

// Mirrors the server's cents-based math (src/lib/orders.ts) so the total
// shown here is exactly what gets charged.
function cartTotals() {
  let subtotalCents = 0;
  let count = 0;
  for (const [id, quantity] of Object.entries(cart)) {
    const item = orderableItems.get(Number(id));
    if (!item) continue;
    subtotalCents += Math.round(item.price * 100) * quantity;
    count += quantity;
  }
  const taxCents = Math.round(subtotalCents * taxRate);
  return { count, subtotal: subtotalCents / 100, tax: taxCents / 100, total: (subtotalCents + taxCents) / 100 };
}

function setQuantity(id, quantity) {
  if (quantity <= 0) delete cart[id];
  else cart[id] = Math.min(quantity, 20);
  writeStorage(CART_KEY, cart);
  renderMenu();
  renderCart();
}

// ---------- Menu ----------

let menuCategories = [];

async function loadMenu() {
  try {
    const res = await fetch("/api/orders/menu");
    const data = await res.json();
    menuCategories = data.categories;
    taxRate = data.taxRate;
    orderableItems = new Map(menuCategories.flatMap((c) => c.items).map((item) => [item.id, item]));

    // Drop anything that got 86'd since it went in the cart.
    const removed = Object.keys(cart).filter((id) => !orderableItems.has(Number(id)));
    if (removed.length) {
      removed.forEach((id) => delete cart[id]);
      writeStorage(CART_KEY, cart);
      showStatus("Heads up: something in your order just sold out and was removed.", "info");
    }

    renderMenu();
    renderCart();
  } catch {
    menuEl.innerHTML = `<p class="empty-note">Couldn't load the menu right now.</p>`;
  }
}

function renderMenu() {
  if (!menuCategories.length) {
    menuEl.innerHTML = `<section class="card"><p class="empty-note">Online ordering is taking a break right now — come see us in person!</p></section>`;
    return;
  }

  menuEl.innerHTML = menuCategories
    .map(
      (category) => `
        <section class="card">
          <h2>${escapeHtml(category.name)}</h2>
          <div class="menu-grid">${category.items.map(renderItemCard).join("")}</div>
        </section>
      `
    )
    .join("");
}

function renderItemCard(item) {
  const quantity = cart[item.id] || 0;
  const control = quantity
    ? `<div class="qty-control">
         <button type="button" data-dec="${item.id}" aria-label="Remove one ${escapeAttr(item.name)}">&minus;</button>
         <span aria-live="polite">${quantity}</span>
         <button type="button" data-inc="${item.id}" aria-label="Add another ${escapeAttr(item.name)}">+</button>
       </div>`
    : `<button type="button" class="add-btn" data-inc="${item.id}">Add</button>`;
  const special = item.dayOfWeek != null ? `<span class="badge local">Today&apos;s Special</span>` : "";

  return `
    <div class="menu-item-card${quantity ? " is-in-cart" : ""}">
      <div class="menu-item-card-header">
        <span class="beer-name">${escapeHtml(item.name)}</span>
        <span class="beer-price">${money(item.price)}</span>
      </div>
      <p class="beer-style m-0">${escapeHtml(item.description || "")}</p>
      <div class="menu-item-card-footer">
        <div class="item-badges mt-0">${special}</div>
        ${control}
      </div>
    </div>
  `;
}

// ---------- Cart ----------

function renderCart() {
  const entries = Object.entries(cart).filter(([id]) => orderableItems.has(Number(id)));
  const totals = cartTotals();

  cartLinesEl.innerHTML = entries.length
    ? entries
        .map(([id, quantity]) => {
          const item = orderableItems.get(Number(id));
          return `
            <li class="cart-line">
              <div class="min-w-0">
                <div class="beer-name">${escapeHtml(item.name)}</div>
                <div class="beer-style">${money(item.price)} each</div>
              </div>
              <div class="qty-control">
                <button type="button" data-dec="${id}" aria-label="Remove one ${escapeAttr(item.name)}">&minus;</button>
                <span>${quantity}</span>
                <button type="button" data-inc="${id}" aria-label="Add another ${escapeAttr(item.name)}">+</button>
              </div>
              <span class="beer-price">${money(item.price * quantity)}</span>
            </li>
          `;
        })
        .join("")
    : `<li class="empty-note">Nothing here yet — add something from the menu above.</li>`;

  cartTotalsEl.innerHTML = entries.length
    ? `
      <div><dt>Subtotal</dt><dd>${money(totals.subtotal)}</dd></div>
      <div><dt>Tax (${(taxRate * 100).toFixed(1)}%)</dt><dd>${money(totals.tax)}</dd></div>
      <div class="is-total"><dt>Total due at pickup</dt><dd>${money(totals.total)}</dd></div>
    `
    : "";

  placeOrderBtn.disabled = !entries.length;
  cartBarCountEl.textContent = `${totals.count} item${totals.count === 1 ? "" : "s"} · ${money(totals.total)}`;
  updateCartBar();
}

// The floating "Review Order" bar only shows when the cart has something
// in it and the cart card itself is off-screen.
let cartInView = false;
function updateCartBar() {
  const hasItems = cartTotals().count > 0;
  const building = !builderEl.classList.contains("hidden");
  cartBarEl.classList.toggle("hidden", !(hasItems && building && !cartInView));
}
new IntersectionObserver(([entry]) => {
  cartInView = entry.isIntersecting;
  updateCartBar();
}).observe(cartEl);

function handleQuantityClick(e) {
  const inc = e.target.closest("[data-inc]");
  const dec = e.target.closest("[data-dec]");
  if (inc) setQuantity(inc.dataset.inc, (cart[inc.dataset.inc] || 0) + 1);
  if (dec) setQuantity(dec.dataset.dec, (cart[dec.dataset.dec] || 0) - 1);
}
menuEl.addEventListener("click", handleQuantityClick);
cartLinesEl.addEventListener("click", handleQuantityClick);

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const items = Object.entries(cart)
    .filter(([id]) => orderableItems.has(Number(id)))
    .map(([id, quantity]) => ({ menuItemId: Number(id), quantity }));
  if (!items.length) {
    showStatus("Add something to your order first.", "error");
    return;
  }

  const data = new FormData(checkoutForm);
  const payload = {
    customerName: String(data.get("customerName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    pickupTime: String(data.get("pickupTime") || "") || undefined,
    notes: String(data.get("notes") || "").trim() || undefined,
    items,
  };

  placeOrderBtn.disabled = true;
  showStatus("Sending your order to the kitchen...", "info");

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showStatus(result.error || "Couldn't place your order.", "error");
      if (res.status === 409) loadMenu();
      return;
    }

    cart = {};
    writeStorage(CART_KEY, null);
    checkoutForm.reset();
    checkoutStatusEl.className = "status-msg";
    startTracking(result.publicId);
  } catch {
    showStatus("Something went wrong. Please try again.", "error");
  } finally {
    placeOrderBtn.disabled = !Object.keys(cart).length;
  }
});

// ---------- Order tracker ----------

const STEPS = ["New", "Preparing", "Ready", "Completed"];
const STEP_LABEL = { New: "Received", Preparing: "Preparing", Ready: "Ready", Completed: "Picked Up" };
const STATUS_MESSAGE = {
  New: "Got it! The kitchen will start on your order shortly.",
  Preparing: "The kitchen is on it.",
  Ready: "Your order is ready — come grab it at the bar.",
  Completed: "Enjoy! Thanks for ordering with us.",
  Cancelled: "This order was cancelled. Give us a call if that's a surprise.",
};

function startTracking(publicId) {
  writeStorage(ORDER_KEY, publicId);
  const url = new URL(window.location.href);
  url.searchParams.set("order", publicId);
  history.replaceState(null, "", url);

  builderEl.classList.add("hidden");
  trackerEl.classList.remove("hidden");
  trackerEl.innerHTML = `<p class="empty-note">Loading your order...</p>`;
  updateCartBar();
  window.scrollTo({ top: trackerEl.offsetTop - 120, behavior: "smooth" });
  pollOrder(publicId);
}

function stopTracking() {
  clearTimeout(trackerTimer);
  writeStorage(ORDER_KEY, null);
  const url = new URL(window.location.href);
  url.searchParams.delete("order");
  history.replaceState(null, "", url);

  trackerEl.classList.add("hidden");
  builderEl.classList.remove("hidden");
  renderPickupSlots();
  loadMenu();
}

async function pollOrder(publicId) {
  clearTimeout(trackerTimer);
  try {
    const res = await fetch(`/api/orders/track/${encodeURIComponent(publicId)}`);
    if (res.status === 404) {
      stopTracking();
      return;
    }
    const order = await res.json();
    renderTracker(order);
    if (order.status === "Completed" || order.status === "Cancelled") return;
  } catch {
    // Keep the last render and try again on the next tick.
  }
  trackerTimer = setTimeout(() => pollOrder(publicId), 5000);
}

function renderTracker(order) {
  const currentStep = STEPS.indexOf(order.status);
  const steps =
    order.status === "Cancelled"
      ? ""
      : `<ol class="order-steps">${STEPS.map(
          (step, i) =>
            `<li class="${i < currentStep ? "is-done" : ""}${i === currentStep ? " is-current" : ""}">${STEP_LABEL[step]}</li>`
        ).join("")}</ol>`;
  const payment =
    order.paymentStatus === "Paid"
      ? `<span class="badge on-tap">Paid &middot; ${escapeHtml(order.paymentMethod || "")}</span>`
      : order.status === "Cancelled"
        ? ""
        : `<span class="badge local">Due at pickup: ${money(order.total)}</span>`;

  trackerEl.innerHTML = `
    <h2>Order #${order.id}</h2>
    <p class="order-status-message${order.status === "Ready" ? " is-ready" : ""}">${STATUS_MESSAGE[order.status]}</p>
    ${steps}
    <p class="empty-note">
      Pickup: ${order.pickupTime ? formatTime12h(order.pickupTime) : "ASAP"} &middot; Name: ${escapeHtml(order.customerName)}
    </p>
    <ul class="cart-list">
      ${order.items
        .map(
          (item) => `
            <li class="cart-line">
              <div class="min-w-0"><div class="beer-name">${item.quantity} &times; ${escapeHtml(item.name)}</div></div>
              <span></span>
              <span class="beer-price">${money(item.unitPrice * item.quantity)}</span>
            </li>`
        )
        .join("")}
    </ul>
    <dl class="order-totals">
      <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
      <div><dt>Tax</dt><dd>${money(order.tax)}</dd></div>
      <div class="is-total"><dt>Total</dt><dd>${money(order.total)}</dd></div>
    </dl>
    ${order.notes ? `<p class="empty-note">Notes: ${escapeHtml(order.notes)}</p>` : ""}
    <div class="flex items-center justify-between gap-3 flex-wrap mt-4">
      ${payment}
      <button type="button" class="secondary" id="new-order-btn">Start a New Order</button>
    </div>
  `;
  trackerEl.querySelector("#new-order-btn").addEventListener("click", stopTracking);
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Boot ----------

renderPickupSlots();
setInterval(renderPickupSlots, 60_000);

// A shared ?order= link always shows that order; an order remembered in
// this browser only reopens while it's still in progress.
async function resumeRememberedOrder(publicId) {
  try {
    const res = await fetch(`/api/orders/track/${encodeURIComponent(publicId)}`);
    const order = res.ok ? await res.json() : null;
    if (order && order.status !== "Completed" && order.status !== "Cancelled") {
      startTracking(publicId);
      return;
    }
  } catch {
    return;
  }
  writeStorage(ORDER_KEY, null);
}

const orderFromUrl = new URLSearchParams(window.location.search).get("order");
const orderFromStorage = readStorage(ORDER_KEY);
if (orderFromUrl) startTracking(orderFromUrl);
else if (orderFromStorage) resumeRememberedOrder(orderFromStorage);
loadMenu();
// Keep availability fresh so 86'd items drop out without a reload.
setInterval(() => {
  if (!builderEl.classList.contains("hidden")) loadMenu();
}, 30_000);
