// server.js (ESM)
import express from "express";
import swaggerUi from "swagger-ui-express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { openDb } from "./db.js";
import { openapiSpec } from "./openapi.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const db = openDb();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// helpers
function rid(prefix = "") {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 18);
}
function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function parseImages(row) {
  if (!row) return row;
  let images = [];
  if (row.images) {
    try { images = JSON.parse(row.images); } catch { images = []; }
  } else if (row.image) {
    images = [row.image];
  }
  return {
    ...row,
    discountPercent: row.discount_percent ?? 0,
    isNew: !!row.is_new,
    reviewsCount: row.reviews_count ?? 0,
    categoryId: row.category_id,
    images,
    image: row.image || images[0] || null,
  };
}

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/openapi.json", (req, res) => res.json(openapiSpec));

// API meta
app.get("/api/meta", (req, res) => {
  res.json({
    name: "Simple Marketplace API (SQLite) — WB-like MVP",
    version: "3.0",
    endpoints: [
      "GET    /docs",
      "GET    /openapi.json",
      "GET    /api/meta",
      "GET    /api/health",
      "GET    /api/categories",
      "GET    /api/products?q=&categoryId=&brand=&inStock=1&minPrice=&maxPrice=&sort=popular|price_asc|price_desc|newest|rating&page=1&limit=12",
      "GET    /api/products/:id (includes variants)",
      "GET    /api/products/:id/variants",
      "GET    /api/products/:id/reviews",
      "POST   /api/products/:id/reviews { author, rating, text }",
      "GET    /api/products/:id/recommendations",
      "GET    /api/brands",
      "GET    /api/favorites",
      "POST   /api/favorites/:productId",
      "DELETE /api/favorites/:productId",
      "GET    /api/cart",
      "POST   /api/cart/items   { variantId, qty }",
      "PATCH  /api/cart/items/:cartItemId  { qty }",
      "DELETE /api/cart/items/:cartItemId",
      "POST   /api/orders  { customer: { name, email } }",
      "GET    /api/orders",
    ],
  });
});

app.get("/api", (req, res) => {
  res.redirect(302, "/docs");
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// categories
app.get("/api/categories", (req, res) => {
  const items = db.prepare(`SELECT id, title FROM categories ORDER BY title`).all();
  res.json({ items });
});

// brands
app.get("/api/brands", (req, res) => {
  const items = db
    .prepare(`SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand <> '' ORDER BY brand`)
    .all()
    .map((r) => r.brand);
  res.json({ items });
});

// favorites
app.get("/api/favorites", (req, res) => {
  const items = db.prepare(`
    SELECT p.*,
           COALESCE((
             SELECT SUM(v.stock) FROM product_variants v WHERE v.product_id = p.id
           ), 0) as stock,
           1 as isFavorite
    FROM favorites f
    JOIN products p ON p.id = f.product_id
    ORDER BY f.created_at DESC
  `).all().map(parseImages);

  res.json({ count: items.length, items });
});

app.post("/api/favorites/:productId", (req, res) => {
  const { productId } = req.params;
  const p = db.prepare(`SELECT id FROM products WHERE id = ?`).get(productId);
  if (!p) return res.status(404).json({ error: "Product not found" });

  db.prepare(`INSERT OR IGNORE INTO favorites (product_id) VALUES (?)`).run(productId);
  res.json({ ok: true });
});

app.delete("/api/favorites/:productId", (req, res) => {
  const { productId } = req.params;
  db.prepare(`DELETE FROM favorites WHERE product_id = ?`).run(productId);
  res.json({ ok: true });
});

// products list
app.get("/api/products", (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const categoryId = (req.query.categoryId || "").toString().trim();
  const brand = (req.query.brand || "").toString().trim();
  const inStock = req.query.inStock ? toInt(req.query.inStock, 0) : 0;
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;

  const sort = (req.query.sort || "popular").toString();
  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(48, Math.max(1, toInt(req.query.limit, 12)));
  const offset = (page - 1) * limit;

  const where = [];
  const params = {};

  if (q) {
    where.push(`(p.title LIKE @q OR p.description LIKE @q)`);
    params.q = `%${q}%`;
  }
  if (categoryId) {
    where.push(`p.category_id = @categoryId`);
    params.categoryId = categoryId;
  }
  if (brand) {
    where.push(`p.brand = @brand`);
    params.brand = brand;
  }
  if (minPrice !== null && Number.isFinite(minPrice)) {
    where.push(`p.price >= @minPrice`);
    params.minPrice = minPrice;
  }
  if (maxPrice !== null && Number.isFinite(maxPrice)) {
    where.push(`p.price <= @maxPrice`);
    params.maxPrice = maxPrice;
  }

  // inStock теперь по variants: есть ли вариант с stock > 0
  if (inStock === 1) {
    where.push(`
      EXISTS (
        SELECT 1 FROM product_variants v
        WHERE v.product_id = p.id AND v.stock > 0
      )
    `);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let orderBy = `p.popularity DESC`;
  if (sort === "price_asc") orderBy = `p.price ASC`;
  if (sort === "price_desc") orderBy = `p.price DESC`;
  if (sort === "newest") orderBy = `p.created_at DESC`;
  if (sort === "rating") orderBy = `p.rating DESC`;

  const total = db.prepare(`
    SELECT COUNT(*) as c
    FROM products p
    ${whereSql}
  `).get(params).c;

  const rows = db.prepare(`
    SELECT
      p.*,
      COALESCE((
        SELECT SUM(v.stock) FROM product_variants v WHERE v.product_id = p.id
      ), 0) as stock,
      CASE WHEN f.product_id IS NULL THEN 0 ELSE 1 END as isFavorite
    FROM products p
    LEFT JOIN favorites f ON f.product_id = p.id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  const items = rows.map(parseImages);

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// product by id (includes variants)
app.get("/api/products/:id", (req, res) => {
  const { id } = req.params;

  const row = db.prepare(`
    SELECT p.*,
           COALESCE((
             SELECT SUM(v.stock) FROM product_variants v WHERE v.product_id = p.id
           ), 0) as stock,
           CASE WHEN f.product_id IS NULL THEN 0 ELSE 1 END as isFavorite
    FROM products p
    LEFT JOIN favorites f ON f.product_id = p.id
    WHERE p.id = ?
  `).get(id);

  if (!row) return res.status(404).json({ error: "Product not found" });

  const variants = db.prepare(`
    SELECT id, product_id as productId, size, color, sku, stock
    FROM product_variants
    WHERE product_id = ?
    ORDER BY color, size
  `).all(id);

  const product = parseImages(row);
  product.variants = variants;

  res.json(product);
});

app.get("/api/products/:id/variants", (req, res) => {
  const { id } = req.params;
  const exists = db.prepare(`SELECT id FROM products WHERE id = ?`).get(id);
  if (!exists) return res.status(404).json({ error: "Product not found" });

  const items = db.prepare(`
    SELECT id, product_id as productId, size, color, sku, stock
    FROM product_variants
    WHERE product_id = ?
    ORDER BY color, size
  `).all(id);

  res.json({ items });
});

// reviews
app.get("/api/products/:id/reviews", (req, res) => {
  const { id } = req.params;
  const exists = db.prepare(`SELECT id FROM products WHERE id = ?`).get(id);
  if (!exists) return res.status(404).json({ error: "Product not found" });

  const items = db.prepare(`
    SELECT id, product_id as productId, author, rating, text, created_at as createdAt
    FROM reviews
    WHERE product_id = ?
    ORDER BY created_at DESC
  `).all(id);

  res.json({ items });
});

app.post("/api/products/:id/reviews", (req, res) => {
  const { id } = req.params;
  const exists = db.prepare(`SELECT id FROM products WHERE id = ?`).get(id);
  if (!exists) return res.status(404).json({ error: "Product not found" });

  const author = (req.body?.author || "").toString().trim() || "Anon";
  const rating = toInt(req.body?.rating, 5);
  const text = (req.body?.text || "").toString().trim() || "";

  if (rating < 1 || rating > 5) return res.status(400).json({ error: "rating must be 1..5" });

  const reviewId = rid("r_");
  db.prepare(`
    INSERT INTO reviews (id, product_id, author, rating, text)
    VALUES (?, ?, ?, ?, ?)
  `).run(reviewId, id, author, rating, text);

  // обновим агрегаты (упрощённо)
  const agg = db.prepare(`
    SELECT AVG(rating) as avgRating, COUNT(*) as cnt
    FROM reviews WHERE product_id = ?
  `).get(id);

  db.prepare(`
    UPDATE products
    SET rating = ?, reviews_count = ?
    WHERE id = ?
  `).run(Number(agg.avgRating || 0), agg.cnt, id);

  res.json({ ok: true, id: reviewId });
});

// recommendations
app.get("/api/products/:id/recommendations", (req, res) => {
  const { id } = req.params;
  const p = db.prepare(`SELECT id, category_id FROM products WHERE id = ?`).get(id);
  if (!p) return res.status(404).json({ error: "Product not found" });

  const items = db.prepare(`
    SELECT
      p.*,
      COALESCE((
        SELECT SUM(v.stock) FROM product_variants v WHERE v.product_id = p.id
      ), 0) as stock,
      CASE WHEN f.product_id IS NULL THEN 0 ELSE 1 END as isFavorite
    FROM products p
    LEFT JOIN favorites f ON f.product_id = p.id
    WHERE p.category_id = ? AND p.id <> ?
    ORDER BY p.popularity DESC
    LIMIT 8
  `).all(p.category_id, id).map(parseImages);

  res.json({ items });
});

// cart
app.get("/api/cart", (req, res) => {
  const items = db.prepare(`
    SELECT
      ci.id,
      ci.variant_id as variantId,
      ci.qty,

      v.sku,
      v.size,
      v.color,
      v.stock as variantStock,

      p.id as productId,
      p.title,
      p.price,
      p.image,
      p.images,
      p.discount_percent,
      p.is_new
    FROM cart_items ci
    JOIN product_variants v ON v.id = ci.variant_id
    JOIN products p ON p.id = v.product_id
    ORDER BY ci.updated_at DESC
  `).all().map((r) => {
    const pr = parseImages(r);
    const discount = pr.discountPercent || 0;
    const base = Number(pr.price);
    const final = discount > 0 ? Math.round(base * (1 - discount / 100)) : base;
    const lineTotal = final * r.qty;

    return {
      id: r.id,
      variantId: r.variantId,
      productId: r.productId,
      title: r.title,
      price: final,
      qty: r.qty,
      lineTotal,

      sku: r.sku,
      size: r.size,
      color: r.color,

      image: pr.image,
    };
  });

  const total = items.reduce((s, x) => s + x.lineTotal, 0);
  res.json({ items, total, updatedAt: new Date().toISOString() });
});

app.post("/api/cart/items", (req, res) => {
  const variantId = (req.body?.variantId || "").toString().trim();
  const qty = Math.max(1, toInt(req.body?.qty, 1));

  if (!variantId) return res.status(400).json({ error: "variantId is required" });

  const v = db.prepare(`
    SELECT v.*, p.title, p.price, p.discount_percent
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    WHERE v.id = ?
  `).get(variantId);

  if (!v) return res.status(404).json({ error: "Variant not found" });
  if (v.stock < qty) return res.status(409).json({ error: "Out of stock" });

  const existing = db.prepare(`SELECT id, qty FROM cart_items WHERE variant_id = ?`).get(variantId);

  if (existing) {
    const nextQty = existing.qty + qty;
    if (v.stock < nextQty) return res.status(409).json({ error: "Out of stock" });

    db.prepare(`UPDATE cart_items SET qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(nextQty, existing.id);
    return res.json({ ok: true, id: existing.id });
  }

  const cartItemId = rid("ci_");
  db.prepare(`INSERT INTO cart_items (id, variant_id, qty) VALUES (?, ?, ?)`).run(cartItemId, variantId, qty);
  res.json({ ok: true, id: cartItemId });
});

app.patch("/api/cart/items/:cartItemId", (req, res) => {
  const { cartItemId } = req.params;
  const qty = toInt(req.body?.qty, 1);

  const row = db.prepare(`
    SELECT ci.id, ci.variant_id as variantId, ci.qty, v.stock
    FROM cart_items ci
    JOIN product_variants v ON v.id = ci.variant_id
    WHERE ci.id = ?
  `).get(cartItemId);

  if (!row) return res.status(404).json({ error: "Cart item not found" });

  if (qty <= 0) {
    db.prepare(`DELETE FROM cart_items WHERE id = ?`).run(cartItemId);
    return res.json({ ok: true });
  }

  if (row.stock < qty) return res.status(409).json({ error: "Out of stock" });

  db.prepare(`UPDATE cart_items SET qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(qty, cartItemId);
  res.json({ ok: true });
});

app.delete("/api/cart/items/:cartItemId", (req, res) => {
  const { cartItemId } = req.params;
  db.prepare(`DELETE FROM cart_items WHERE id = ?`).run(cartItemId);
  res.json({ ok: true });
});

// orders
app.post("/api/orders", (req, res) => {
  const name = (req.body?.customer?.name || "").toString().trim();
  const email = (req.body?.customer?.email || "").toString().trim();
  if (!name || !email) return res.status(400).json({ error: "customer.name and customer.email are required" });

  const cart = db.prepare(`
    SELECT
      ci.id as cartItemId,
      ci.variant_id as variantId,
      ci.qty,
      v.stock,
      v.sku,
      v.size,
      v.color,
      p.id as productId,
      p.title,
      p.price,
      p.discount_percent
    FROM cart_items ci
    JOIN product_variants v ON v.id = ci.variant_id
    JOIN products p ON p.id = v.product_id
  `).all();

  if (cart.length === 0) return res.status(400).json({ error: "Cart is empty" });

  // check stock
  for (const it of cart) {
    if (it.stock < it.qty) return res.status(409).json({ error: `Out of stock for SKU ${it.sku}` });
  }

  const orderId = rid("o_");
  const insOrder = db.prepare(`INSERT INTO orders (id, customer_name, customer_email, total) VALUES (?, ?, ?, 0)`);
  const insItem = db.prepare(`
    INSERT INTO order_items
      (id, order_id, variant_id, product_id, sku, size, color, title, price, qty, line_total)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateVariantStock = db.prepare(`UPDATE product_variants SET stock = stock - ? WHERE id = ?`);

  db.transaction(() => {
    insOrder.run(orderId, name, email);

    let total = 0;
    for (const it of cart) {
      const discount = Number(it.discount_percent || 0);
      const base = Number(it.price);
      const final = discount > 0 ? Math.round(base * (1 - discount / 100)) : base;
      const lineTotal = final * it.qty;
      total += lineTotal;

      insItem.run(
        rid("oi_"),
        orderId,
        it.variantId,
        it.productId,
        it.sku,
        it.size,
        it.color,
        it.title,
        final,
        it.qty,
        lineTotal
      );

      updateVariantStock.run(it.qty, it.variantId);
    }

    db.prepare(`UPDATE orders SET total = ? WHERE id = ?`).run(total, orderId);
    db.prepare(`DELETE FROM cart_items`).run();
  })();

  res.json({ ok: true, id: orderId });
});

app.get("/api/orders", (req, res) => {
  const orders = db.prepare(`SELECT * FROM orders ORDER BY created_at DESC`).all();
  const itemsByOrder = db.prepare(`
    SELECT order_id as orderId, variant_id as variantId, product_id as productId, sku, size, color, title, price, qty, line_total as lineTotal
    FROM order_items
    WHERE order_id = ?
  `);

  const items = orders.map((o) => ({
    ...o,
    items: itemsByOrder.all(o.id),
  }));

  res.json({ items });
});

// Start
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`✅ API server running: http://localhost:${PORT}`);
  console.log(`✅ Static: http://localhost:${PORT}/`);
  console.log(`✅ Swagger docs: http://localhost:${PORT}/docs`);
  console.log(`✅ OpenAPI JSON: http://localhost:${PORT}/openapi.json`);
  console.log(`✅ API meta: http://localhost:${PORT}/api/meta`);
});
