const rootEl = document.getElementById("menu-root");
const statusEl = document.getElementById("menu-status");
const categorySelect = document.getElementById("itemCategoryId");

const itemForm = document.getElementById("item-form");
const itemFormTitle = document.getElementById("item-form-title");
const itemFormSubmit = document.getElementById("item-form-submit");
const itemFormCancel = document.getElementById("item-form-cancel");
const itemFormStatus = document.getElementById("item-form-status");

const categoryForm = document.getElementById("category-form");
const categoryFormStatus = document.getElementById("category-form-status");

let currentMenu = [];

function showStatus(message, type) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-msg show ${type}`;
}

function showFormStatus(el, message, type) {
  el.textContent = message;
  el.className = `status-msg show ${type}`;
}

async function loadMenu() {
  try {
    const res = await fetch("/api/menu/all");
    const menu = await res.json();
    currentMenu = menu;
    populateCategorySelect(menu);
    renderMenu(menu);
  } catch {
    rootEl.innerHTML = `<p class="empty-note">Couldn't load the menu right now.</p>`;
    showStatus("Couldn't load the menu right now. Check your connection and reload.", "error");
  }
}

function populateCategorySelect(menu) {
  const selected = categorySelect.value;
  categorySelect.innerHTML = menu
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("");
  if (selected) categorySelect.value = selected;
}

function renderMenu(menu) {
  if (!menu.length) {
    rootEl.innerHTML = `<p class="empty-note">No categories yet — add one above.</p>`;
    return;
  }

  rootEl.innerHTML = menu
    .map(
      (category) => `
        <section class="card">
          <h2>
            ${escapeHtml(category.name)}
            <select class="ml-auto" style="width:auto;min-height:0;padding:4px 8px;" data-category-section="${category.id}">
              <option value="" ${!category.section ? "selected" : ""}>No dedicated page</option>
              <option value="burgers" ${category.section === "burgers" ? "selected" : ""}>Burgers (/burgers)</option>
              <option value="appetizers" ${category.section === "appetizers" ? "selected" : ""}>Appetizers (/appetizers)</option>
              <option value="drinks" ${category.section === "drinks" ? "selected" : ""}>Drinks (/drinks)</option>
            </select>
            <button type="button" class="secondary" data-delete-category="${category.id}">Delete Category</button>
          </h2>
          <ul class="beer-list">${category.items.length ? category.items.map(renderItem).join("") : `<li class="empty-note">Nothing here yet.</li>`}</ul>
        </section>
      `
    )
    .join("");

  rootEl.querySelectorAll('input[type="checkbox"][data-id]').forEach((input) => {
    input.addEventListener("change", () => toggleItem(input.dataset.id));
  });
  rootEl.querySelectorAll("button[data-edit-item]").forEach((btn) => {
    btn.addEventListener("click", () => startEditItem(btn.dataset.editItem));
  });
  rootEl.querySelectorAll("button[data-delete-item]").forEach((btn) => {
    btn.addEventListener("click", () => deleteItem(btn.dataset.deleteItem));
  });
  rootEl.querySelectorAll("button[data-delete-category]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCategory(btn.dataset.deleteCategory));
  });
  rootEl.querySelectorAll("select[data-category-section]").forEach((select) => {
    select.addEventListener("change", () => updateCategorySection(select.dataset.categorySection, select.value));
  });
}

async function updateCategorySection(id, section) {
  try {
    const res = await fetch(`/api/menu/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: section || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't update that category's page.", "error");
      loadMenu();
      return;
    }
    loadMenu();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

function renderItem(item) {
  const isBeverage = item.abv != null;
  const rowClass = item.isAvailable ? "beer-row" : "beer-row is-sold-out";
  const checked = item.isAvailable ? "" : "checked";
  const label = isBeverage
    ? item.isAvailable ? "On Tap" : "Sold Out"
    : item.isAvailable ? "Available" : "86'd";
  const abv = isBeverage ? ` &middot; ${item.abv}% ABV` : "";
  const servings =
    isBeverage && item.servingsRemaining != null ? ` &middot; ${item.servingsRemaining} left` : "";
  const inactiveBadge = item.isActive ? "" : `<span class="badge sold-out">Hidden (inactive)</span>`;

  return `
    <li class="${rowClass}">
      <div class="beer-main">
        ${itemThumb(item, isBeverage)}
        <div class="beer-info">
          <div class="beer-name">${escapeHtml(item.name)}</div>
          <div class="beer-style">${escapeHtml(item.description || "")}${abv}${servings}</div>
          ${inactiveBadge ? `<div class="item-badges">${inactiveBadge}</div>` : ""}
        </div>
      </div>
      <div class="beer-meta">
        <span class="beer-price">$${item.price.toFixed(2)}</span>
        <div class="beer-controls">
          <span class="switch-label">${label}</span>
          <label class="switch">
            <input type="checkbox" data-id="${item.id}" ${checked} />
            <span class="slider"></span>
          </label>
        </div>
        <div class="flex gap-1.5 flex-wrap">
          <button type="button" class="secondary" data-edit-item="${item.id}">Edit</button>
          <button type="button" class="secondary" data-delete-item="${item.id}">Delete</button>
        </div>
      </div>
    </li>
  `;
}

const BEER_GLASS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l-1 15a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 3Z"/><path d="M6.5 8H4a1 1 0 0 0-1 1v2a2 2 0 0 0 2 2h1.2"/><path d="M6 3c0 1.5 1 2 1.5 3S9 8 9 9"/></svg>`;
const PLATE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>`;

function itemThumb(item, isBeverage) {
  if (item.imageUrl) {
    return `<div class="item-thumb"><img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" /></div>`;
  }
  return `<div class="item-thumb">${isBeverage ? BEER_GLASS_ICON : PLATE_ICON}</div>`;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

async function toggleItem(id) {
  try {
    const res = await fetch(`/api/menu/${id}`, { method: "PATCH" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't update that item.", "error");
      return;
    }
    loadMenu();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

async function deleteItem(id) {
  if (!confirm("Delete this menu item? This can't be undone.")) return;
  try {
    const res = await fetch(`/api/menu/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't delete that item.", "error");
      return;
    }
    loadMenu();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

async function deleteCategory(id) {
  if (!confirm("Delete this category and ALL of its menu items? This can't be undone.")) return;
  try {
    const res = await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || "Couldn't delete that category.", "error");
      return;
    }
    loadMenu();
  } catch {
    showStatus("Something went wrong. The connection to the database may have dropped — please try again.", "error");
  }
}

function startEditItem(id) {
  const item = currentMenu.flatMap((c) => c.items).find((i) => String(i.id) === String(id));
  if (!item) return;

  itemForm.itemId.value = item.id;
  itemForm.categoryId.value = item.categoryId;
  itemForm.name.value = item.name;
  itemForm.description.value = item.description || "";
  itemForm.price.value = item.price;
  itemForm.abv.value = item.abv ?? "";
  itemForm.imageUrl.value = item.imageUrl || "";
  itemForm.dayOfWeek.value = item.dayOfWeek ?? "";
  itemForm.servingsRemaining.value = item.servingsRemaining ?? "";
  itemForm.isLocal.checked = item.isLocal;
  itemForm.isGlutenFree.checked = item.isGlutenFree;

  itemFormTitle.textContent = `Edit "${item.name}"`;
  itemFormSubmit.textContent = "Save Changes";
  itemFormCancel.classList.remove("hidden");
  itemForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetItemForm() {
  itemForm.reset();
  itemForm.itemId.value = "";
  itemFormTitle.textContent = "Add a Menu Item";
  itemFormSubmit.textContent = "Add Item";
  itemFormCancel.classList.add("hidden");
}

itemFormCancel.addEventListener("click", resetItemForm);

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(itemForm);
  const id = String(data.get("itemId") || "").trim();
  const abv = String(data.get("abv") || "").trim();
  const dayOfWeek = String(data.get("dayOfWeek") || "").trim();
  const servingsRemaining = String(data.get("servingsRemaining") || "").trim();

  const payload = {
    categoryId: Number(data.get("categoryId")),
    name: String(data.get("name") || "").trim(),
    description: String(data.get("description") || "").trim() || undefined,
    price: Number(data.get("price")),
    abv: abv ? Number(abv) : undefined,
    imageUrl: String(data.get("imageUrl") || "").trim() || undefined,
    dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
    servingsRemaining: servingsRemaining ? Number(servingsRemaining) : undefined,
    isLocal: itemForm.isLocal.checked,
    isGlutenFree: itemForm.isGlutenFree.checked,
  };

  const submitBtn = itemFormSubmit;
  submitBtn.disabled = true;

  try {
    const res = await fetch(id ? `/api/menu/${id}` : "/api/menu", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFormStatus(itemFormStatus, result.error || "Couldn't save that item.", "error");
      return;
    }
    showFormStatus(itemFormStatus, `Saved "${payload.name}".`, "success");
    resetItemForm();
    loadMenu();
  } catch {
    showFormStatus(itemFormStatus, "Something went wrong. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(categoryForm);
  const payload = {
    name: String(data.get("name") || "").trim(),
    displayOrder: Number(data.get("displayOrder") || 0),
    imageUrl: String(data.get("imageUrl") || "").trim() || undefined,
    section: String(data.get("section") || "").trim() || undefined,
  };

  const submitBtn = categoryForm.querySelector("button");
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/menu/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFormStatus(categoryFormStatus, result.error || "Couldn't add that category.", "error");
      return;
    }
    showFormStatus(categoryFormStatus, `"${payload.name}" added.`, "success");
    categoryForm.reset();
    loadMenu();
  } catch {
    showFormStatus(categoryFormStatus, "Something went wrong. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadMenu();
