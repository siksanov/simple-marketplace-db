const elProducts = document.getElementById("products");
const elOrders = document.getElementById("orders");

const elCategories = document.getElementById("categories");
const elSearch = document.getElementById("search");
const btnSearch = document.getElementById("btnSearch");
const btnApply = document.getElementById("btnApply");
const btnReset = document.getElementById("btnReset");
const goHome = document.getElementById("goHome");

const elMinPrice = document.getElementById("minPrice");
const elMaxPrice = document.getElementById("maxPrice");
const elInStock = document.getElementById("inStock");
const elBrand = document.getElementById("brand");
const elSort = document.getElementById("sort");

const btnMore = document.getElementById("btnMore");
const metaText = document.getElementById("metaText");
const modeBadge = document.getElementById("modeBadge");

// Favorites drawer
const btnFavorites = document.getElementById("btnFavorites");
const favCount = document.getElementById("favCount");
const favBackdrop = document.getElementById("favBackdrop");
const favDrawer = document.getElementById("favDrawer");
const btnCloseFav = document.getElementById("btnCloseFav");
const favItems = document.getElementById("favItems");
const favSub = document.getElementById("favSub");

// Cart drawer
const btnCart = document.getElementById("btnCart");
const drawer = document.getElementById("drawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const elCartCount = document.getElementById("cartCount");
const elCartItems = document.getElementById("cartItems");
const elCartTotal = document.getElementById("cartTotal");
const elCartUpdatedAt = document.getElementById("cartUpdatedAt");
const custName = document.getElementById("custName");
const custEmail = document.getElementById("custEmail");
const btnCheckout = document.getElementById("btnCheckout");
const checkoutMsg = document.getElementById("checkoutMsg");

// Modal
const modalBackdrop = document.getElementById("modalBackdrop");
const modal = document.getElementById("modal");
const btnCloseModal = document.getElementById("btnCloseModal");
const mTitle = document.getElementById("mTitle");
const mSub = document.getElementById("mSub");
const mImg = document.getElementById("mImg");
const mDesc = document.getElementById("mDesc");
const mMeta = document.getElementById("mMeta");
const mPrice = document.getElementById("mPrice");
const mStock = document.getElementById("mStock");
const mVariants = document.getElementById("mVariants");
const mFav = document.getElementById("mFav");
const mAdd = document.getElementById("mAdd");

function rub(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const msg = data?.error ? `${data.error}` : `HTTP_${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ------------------------ UI Open/Close Helpers ------------------------ */

function openPane(el, backdrop) {
  el.classList.remove("hidden");
  backdrop.classList.remove("hidden");
  el.setAttribute("aria-hidden", "false");
}
function closePane(el, backdrop) {
  el.classList.add("hidden");
  backdrop.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
}

function openModal() {
  modal.classList.remove("hidden");
  modalBackdrop.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal.classList.add("hidden");
  modalBackdrop.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

/* ------------------------------ State ------------------------------ */

const state = {
  categoryId: "",
  q: "",
  minPrice: "",
  maxPrice: "",
  inStock: false,
  brand: "",
  sort: "popular",

  page: 1,
  limit: 15,
  total: 0,
  totalPages: 1,

  mode: "catalog"
};

function syncControlsFromState() {
  elSearch.value = state.q;
  elMinPrice.value = state.minPrice;
  elMaxPrice.value = state.maxPrice;
  elInStock.checked = state.inStock;
  elBrand.value = state.brand;
  elSort.value = state.sort;
  renderActiveCategoryChip();
}

function resetToDefault() {
  state.categoryId = "";
  state.q = "";
  state.minPrice = "";
  state.maxPrice = "";
  state.inStock = false;
  state.brand = "";
  state.sort = "popular";
  state.page = 1;
  state.mode = "catalog";
  syncControlsFromState();
}

function buildProductsQuery(pageOverride = null) {
  const params = new URLSearchParams();
  const page = pageOverride ?? state.page;

  if (state.q) params.set("q", state.q);
  if (state.categoryId) params.set("categoryId", state.categoryId);
  if (state.brand) params.set("brand", state.brand);
  if (state.inStock) params.set("inStock", "1");
  if (state.minPrice) params.set("minPrice", state.minPrice);
  if (state.maxPrice) params.set("maxPrice", state.maxPrice);
  if (state.sort) params.set("sort", state.sort);

  params.set("page", String(page));
  params.set("limit", String(state.limit));

  return `/api/products?${params.toString()}`;
}

function renderMeta() {
  modeBadge.textContent = state.mode === "favorites" ? "Режим: избранное" : "Режим: каталог";

  if (state.mode === "favorites") return;

  metaText.textContent = `Найдено: ${state.total} · Страница ${state.page}/${state.totalPages} · ${labelSort(state.sort)}`;
}

function labelSort(sort) {
  switch (sort) {
    case "newest": return "Сортировка: новинки";
    case "rating": return "Сортировка: рейтинг";
    case "price_asc": return "Сортировка: цена ↑";
    case "price_desc": return "Сортировка: цена ↓";
    case "popular":
    default: return "Сортировка: популярное";
  }
}

function renderProducts(items, { append = false } = {}) {
  const html = items.map((p) => {
    const stock = Number(p.stock || 0);
    const stockBadge = stock > 0
      ? `<span class="badge badge--ok">В наличии</span>`
      : `<span class="badge badge--no">Нет</span>`;

    const heartClass = p.isFavorite ? "heart heart--on" : "heart";
    const rating = `⭐ ${Number(p.rating || 0).toFixed(1)} · ${p.reviewsCount || 0}`;

    return `
      <article class="card" data-id="${p.id}">
        <div class="${heartClass}" data-action="toggleFav" data-id="${p.id}">
          ${p.isFavorite ? "❤️" : "🤍"}
        </div>

        <div class="card__img" style="background-image:url('${p.image || "/img/products/placeholder.svg"}')"></div>

        <div class="card__body">
          <div class="card__row">
            <div class="price">${rub(p.price)} ₽</div>
            ${stockBadge}
          </div>

          <div class="card__title">${p.title}</div>
          <div class="rating">${rating}</div>
          <div class="small">${p.brand}</div>

          <div class="card__desc">${p.description}</div>

          <div class="card__row">
            <button class="btn" data-action="details" data-id="${p.id}">Карточка</button>
            <button class="btn btn--primary" data-action="add" data-id="${p.id}" ${stock <= 0 ? "disabled" : ""}>
              В корзину
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (append) elProducts.insertAdjacentHTML("beforeend", html);
  else elProducts.innerHTML = html;
}

async function loadCatalog({ append = false } = {}) {
  state.mode = "catalog";
  const url = buildProductsQuery();
  const data = await api(url);

  state.total = data.total;
  state.totalPages = data.totalPages;
  state.page = data.page;

  renderProducts(data.items, { append });
  renderMeta();

  btnMore.classList.toggle("hidden", !(state.page < state.totalPages));
}

async function loadMore() {
  if (state.page >= state.totalPages) return;
  state.page += 1;

  const url = buildProductsQuery(state.page);
  const data = await api(url);

  state.total = data.total;
  state.totalPages = data.totalPages;

  renderProducts(data.items, { append: true });
  renderMeta();

  btnMore.classList.toggle("hidden", !(state.page < state.totalPages));
}

/* ------------------------------ Categories / Brands ------------------------------ */

function renderActiveCategoryChip() {
  const chips = Array.from(elCategories.querySelectorAll(".chip"));
  chips.forEach((c) => c.classList.toggle("chip--active", (c.dataset.id || "") === state.categoryId));
}

async function loadCategories() {
  const data = await api("/api/categories");
  const allChip = `<button class="chip chip--active" data-id="">Все</button>`;
  const chips = data.items.map((c) => `<button class="chip" data-id="${c.id}">${c.title}</button>`).join("");
  elCategories.innerHTML = allChip + chips;
}

async function loadBrands() {
  const data = await api("/api/brands");
  elBrand.innerHTML = [`<option value="">Все</option>`]
    .concat(data.items.map((b) => `<option value="${b}">${b}</option>`))
    .join("");
}

/* ------------------------------ Favorites ------------------------------ */

async function refreshFavCount() {
  const data = await api("/api/favorites");
  favCount.textContent = String(data.count);
}

async function openFavorites() {
  const data = await api("/api/favorites");
  favCount.textContent = String(data.count);
  favSub.textContent = `Товаров: ${data.count}`;

  if (data.count === 0) {
    favItems.innerHTML = `<div class="muted">Пока пусто. Нажми ❤️ на карточке товара.</div>`;
  } else {
    favItems.innerHTML = data.items.map((p) => `
      <div class="cartItem">
        <div>
          <div class="cartItem__title">${p.title}</div>
          <div class="cartItem__meta">${rub(p.price)} ₽ · ${p.brand}</div>
        </div>
        <div class="qty">
          <button class="btn" data-action="favDetails" data-id="${p.id}">Карточка</button>
          <button class="btn btn--ghost" data-action="favRemove" data-id="${p.id}">Убрать ❤️</button>
        </div>
      </div>
    `).join("");
  }

  openPane(favDrawer, favBackdrop);
}

async function setFavorite(productId, on) {
  if (on) await api(`/api/favorites/${productId}`, { method: "POST" });
  else await api(`/api/favorites/${productId}`, { method: "DELETE" });
  await refreshFavCount();
}

/* ------------------------------ Cart ------------------------------ */

async function loadCart() {
  const data = await api("/api/cart");
  const count = data.items.reduce((s, it) => s + it.qty, 0);

  elCartCount.textContent = String(count);
  elCartUpdatedAt.textContent = `Обновлено: ${new Date(data.updatedAt).toLocaleString("ru-RU")}`;
  elCartTotal.textContent = rub(data.total);

  if (data.items.length === 0) {
    elCartItems.innerHTML = `<div class="muted">Корзина пустая. Добавь товары на витрине 🙂</div>`;
    return;
  }

  elCartItems.innerHTML = data.items.map((it) => `
    <div class="cartItem">
      <div>
        <div class="cartItem__title">${it.title}</div>
        <div class="cartItem__meta">${rub(it.price)} ₽ × ${it.qty} = <b>${rub(it.lineTotal)} ₽</b></div>
      </div>
      <div class="qty">
        <div class="qty__row">
          <button class="btn" data-action="dec" data-ci="${it.id}">−</button>
          <div class="qty__val">${it.qty}</div>
          <button class="btn" data-action="inc" data-ci="${it.id}">+</button>
        </div>
        <button class="btn btn--ghost" data-action="remove" data-ci="${it.id}">Удалить</button>
      </div>
    </div>
  `).join("");
}

async function addToCart(variantId, qty = 1) {
  await api("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ variantId, qty })
  });
  await loadCart();
}

async function patchCartItem(cartItemId, qty) {
  await api(`/api/cart/items/${cartItemId}`, {
    method: "PATCH",
    body: JSON.stringify({ qty })
  });
  await loadCart();
}

async function removeCartItem(cartItemId) {
  await api(`/api/cart/items/${cartItemId}`, { method: "DELETE" });
  await loadCart();
}

async function checkout() {
  checkoutMsg.textContent = "";
  btnCheckout.disabled = true;

  try {
    const name = custName.value.trim();
    const email = custEmail.value.trim();

    const order = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({ customer: { name, email } })
    });

    checkoutMsg.textContent = `✅ Заказ создан: ${order.id}`;
    custName.value = "";
    custEmail.value = "";

    await loadCart();
    state.page = 1;
    await loadCatalog({ append: false });
    await loadOrders();
  } catch (e) {
    if (e.data?.error === "OUT_OF_STOCK") {
      checkoutMsg.textContent = `❌ Нет в наличии: ${e.data.productId} (доступно: ${e.data.available})`;
    } else {
      checkoutMsg.textContent = `❌ Ошибка: ${e.message}`;
    }
  } finally {
    btnCheckout.disabled = false;
  }
}

/* ------------------------------ Orders ------------------------------ */

async function loadOrders() {
  const data = await api("/api/orders");
  if (data.items.length === 0) {
    elOrders.innerHTML = `<div class="muted">Пока нет заказов. Оформи заказ из корзины — появится здесь.</div>`;
    return;
  }

  elOrders.innerHTML = data.items.map((o) => `
    <div class="order">
      <div class="order__head">
        <div>
          <div><b>Заказ:</b> ${o.id}</div>
          <div class="muted">${new Date(o.created_at).toLocaleString("ru-RU")}</div>
          <div class="muted">${o.customer_name} · ${o.customer_email}</div>
        </div>
        <div style="text-align:right">
          <div class="muted">Сумма</div>
          <div style="font-weight:950;font-size:18px">${rub(o.total)} ₽</div>
        </div>
      </div>
      <div class="order__items">
        ${o.items.map((it) => `• ${it.title} — ${it.qty} шт. (${rub(it.line_total)} ₽)`).join("<br>")}
      </div>
    </div>
  `).join("");
}

/* ------------------------------ Product Modal ------------------------------ */

let modalProduct = null;
let modalVariantId = "";

async function pickVariantForProduct(productId) {
  const data = await api(`/api/products/${productId}/variants`);
  const inStock = (data.items || []).find((x) => Number(x.stock) > 0);
  return inStock || data.items?.[0] || null;
}

async function showProduct(productId) {
  const p = await api(`/api/products/${productId}`);
  modalProduct = p;
  modalVariantId = "";

  mTitle.textContent = p.title;
  mSub.textContent = `${p.brand} · ⭐ ${Number(p.rating).toFixed(1)} · ${p.reviewsCount || 0} отзывов`;
  mImg.style.backgroundImage = `url('${p.image || "/img/products/placeholder.svg"}')`;
  mDesc.textContent = p.description;

  mPrice.textContent = `${rub(p.price)} ₽`;
  mStock.textContent = p.stock > 0 ? `Всего в наличии: ${p.stock}` : `Нет в наличии`;

  mMeta.innerHTML = `
    <div class="muted">categoryId: ${p.categoryId}</div>
    <div class="muted">popularity: ${p.popularity}</div>
  `;

  const variants = Array.isArray(p.variants) ? p.variants : [];
  if (variants.length === 0) {
    mVariants.innerHTML = `<div class="muted">Варианты недоступны</div>`;
    mAdd.disabled = true;
  } else {
    modalVariantId = (variants.find((x) => Number(x.stock) > 0) || variants[0]).id;
    mVariants.innerHTML = variants.map((v) => `
      <button class="variantChip ${v.id === modalVariantId ? "variantChip--on" : ""}" data-action="variant" data-vid="${v.id}" ${Number(v.stock) <= 0 ? "disabled" : ""}>
        ${v.color || "Default"} / ${v.size || "One size"} · ${v.stock > 0 ? `остаток ${v.stock}` : "нет"}
      </button>
    `).join("");
    const active = variants.find((x) => x.id === modalVariantId);
    mAdd.disabled = !active || Number(active.stock) <= 0;
  }

  mFav.textContent = p.isFavorite ? "❤️ В избранном" : "🤍 В избранное";

  openModal();
}

async function toggleModalFav() {
  if (!modalProduct) return;
  const nextOn = !modalProduct.isFavorite;
  await setFavorite(modalProduct.id, nextOn);
  modalProduct.isFavorite = nextOn;
  mFav.textContent = nextOn ? "❤️ В избранном" : "🤍 В избранное";

  // обновим текущую выдачу: просто перезагрузим 1 страницу (стабильно для демо)
  state.page = 1;
  await loadCatalog({ append: false });
}

/* ------------------------------ Events ------------------------------ */

elCategories.addEventListener("click", async (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;

  state.categoryId = btn.dataset.id || "";
  state.page = 1;
  renderActiveCategoryChip();
  await loadCatalog({ append: false });
});

btnSearch.addEventListener("click", async () => {
  state.q = elSearch.value.trim();
  state.page = 1;
  await loadCatalog({ append: false });
});
elSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnSearch.click();
});

btnApply.addEventListener("click", async () => {
  state.q = elSearch.value.trim();
  state.minPrice = elMinPrice.value.trim();
  state.maxPrice = elMaxPrice.value.trim();
  state.inStock = elInStock.checked;
  state.brand = elBrand.value;
  state.sort = elSort.value;

  state.page = 1;
  await loadCatalog({ append: false });
});

btnReset.addEventListener("click", async () => {
  resetToDefault();
  await loadCatalog({ append: false });
});

goHome.addEventListener("click", async () => {
  resetToDefault();
  await loadCatalog({ append: false });
});

btnMore.addEventListener("click", loadMore);

elProducts.addEventListener("click", async (e) => {
  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const id = actionBtn.dataset.id;

  try {
    if (action === "add") {
      const variant = await pickVariantForProduct(id);
      if (!variant || Number(variant.stock) <= 0) {
        alert("Нет доступных вариантов в наличии");
        return;
      }
      await addToCart(variant.id, 1);
      return;
    }
    if (action === "details") {
      await showProduct(id);
      return;
    }
    if (action === "toggleFav") {
      const heart = actionBtn;
      const wasOn = heart.classList.contains("heart--on");
      const nextOn = !wasOn;

      await setFavorite(id, nextOn);

      heart.classList.toggle("heart--on", nextOn);
      heart.textContent = nextOn ? "❤️" : "🤍";
      return;
    }
  } catch (err) {
    alert(`Ошибка: ${err.message}`);
  }
});

// favorites drawer
btnFavorites.addEventListener("click", openFavorites);
btnCloseFav.addEventListener("click", () => closePane(favDrawer, favBackdrop));
favBackdrop.addEventListener("click", () => closePane(favDrawer, favBackdrop));

favItems.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  try {
    if (action === "favDetails") {
      await showProduct(id);
      return;
    }
    if (action === "favRemove") {
      await setFavorite(id, false);
      await openFavorites();
      state.page = 1;
      await loadCatalog({ append: false });
      return;
    }
  } catch (err) {
    alert(`Ошибка: ${err.message}`);
  }
});

// cart drawer
btnCart.addEventListener("click", async () => {
  await loadCart();
  openPane(drawer, drawerBackdrop);
});
btnCloseDrawer.addEventListener("click", () => closePane(drawer, drawerBackdrop));
drawerBackdrop.addEventListener("click", () => closePane(drawer, drawerBackdrop));

elCartItems.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const cartItemId = btn.dataset.ci;

  try {
    const cart = await api("/api/cart");
    const item = cart.items.find((x) => x.id === cartItemId);
    const currentQty = item?.qty ?? 0;

    if (action === "inc") await patchCartItem(cartItemId, currentQty + 1);
    if (action === "dec") await patchCartItem(cartItemId, currentQty - 1);
    if (action === "remove") await removeCartItem(cartItemId);

    await loadCart();
  } catch (err) {
    alert(`Ошибка: ${err.message}`);
  }
});

btnCheckout.addEventListener("click", checkout);

// modal
btnCloseModal.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
mFav.addEventListener("click", toggleModalFav);
mVariants.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action='variant']");
  if (!btn || !modalProduct?.variants?.length) return;

  modalVariantId = btn.dataset.vid;
  const active = modalProduct.variants.find((x) => x.id === modalVariantId);
  mAdd.disabled = !active || Number(active.stock) <= 0;

  Array.from(mVariants.querySelectorAll(".variantChip")).forEach((x) => {
    x.classList.toggle("variantChip--on", x.dataset.vid === modalVariantId);
  });
});

mAdd.addEventListener("click", async () => {
  if (!modalProduct || !modalVariantId) return;
  await addToCart(modalVariantId, 1);
  closeModal();
});

// Init
(async function init() {
  try {
    await loadCategories();
    await loadBrands();
    await refreshFavCount();
    await loadCart();
    await loadCatalog({ append: false });
    await loadOrders();
  } catch (e) {
    elProducts.innerHTML = `<div class="muted">Не удалось загрузить данные. Проверь, что сервер запущен.</div>`;
    metaText.textContent = "Ошибка загрузки.";
    console.error(e);
  }
})();
