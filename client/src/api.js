async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }

  return data;
}

export const API = {
  health: () => api("/api/health"),
  categories: () => api("/api/categories"),
  brands: () => api("/api/brands"),

  products: (params) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/api/products?${qs}`);
  },
  product: (id) => api(`/api/products/${id}`),
  variants: (id) => api(`/api/products/${id}/variants`),

  favorites: () => api("/api/favorites"),
  favAdd: (productId) => api(`/api/favorites/${productId}`, { method: "POST" }),
  favRemove: (productId) => api(`/api/favorites/${productId}`, { method: "DELETE" }),

  cart: () => api("/api/cart"),
  cartAdd: (variantId, qty = 1) =>
    api("/api/cart/items", { method: "POST", body: JSON.stringify({ variantId, qty }) }),
  cartUpdate: (cartItemId, qty) =>
    api(`/api/cart/items/${cartItemId}`, { method: "PATCH", body: JSON.stringify({ qty }) }),
  cartRemove: (cartItemId) => api(`/api/cart/items/${cartItemId}`, { method: "DELETE" }),

  reviews: (productId) => api(`/api/products/${productId}/reviews`),
  reviewAdd: (productId, payload) =>
    api(`/api/products/${productId}/reviews`, { method: "POST", body: JSON.stringify(payload) }),

  recommendations: (productId) => api(`/api/products/${productId}/recommendations`),
};
