// db.js (ESM)
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DB_DIR = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_DIR, "marketplace.sqlite");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function rid(prefix = "") {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 18);
}

function hasTable(db, name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function tableColumns(db, table) {
  if (!hasTable(db, table)) return [];
  return db.prepare(`PRAGMA table_info(${table})`).all().map((x) => x.name);
}

function ensureBaseSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      brand TEXT,
      category_id TEXT NOT NULL,

      image TEXT,
      images TEXT,

      discount_percent INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 0,

      rating REAL DEFAULT 4.6,
      reviews_count INTEGER DEFAULT 0,
      popularity INTEGER DEFAULT 0,

      created_at TEXT DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      size TEXT,
      color TEXT,
      sku TEXT NOT NULL UNIQUE,
      stock INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      author TEXT NOT NULL,
      rating INTEGER NOT NULL,
      text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);
}

function ensureFavoritesTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY DEFAULT ('f_' || lower(hex(randomblob(10)))),
      product_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);
}

function ensureCartSchema(db) {
  const hasCart = hasTable(db, "cart_items");

  if (!hasCart) {
    db.exec(`
      CREATE TABLE cart_items (
        id TEXT PRIMARY KEY DEFAULT ('ci_' || lower(hex(randomblob(10)))),
        variant_id TEXT NOT NULL,
        qty INTEGER NOT NULL CHECK (qty > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON cart_items(variant_id);
    `);
    return;
  }

  const cols = tableColumns(db, "cart_items");
  const hasVariantId = cols.includes("variant_id");
  const hasProductId = cols.includes("product_id");

  if (hasVariantId) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON cart_items(variant_id);`);
    return;
  }

  if (!hasProductId) {
    db.exec(`DROP TABLE cart_items;`);
    db.exec(`
      CREATE TABLE cart_items (
        id TEXT PRIMARY KEY DEFAULT ('ci_' || lower(hex(randomblob(10)))),
        variant_id TEXT NOT NULL,
        qty INTEGER NOT NULL CHECK (qty > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON cart_items(variant_id);
    `);
    return;
  }

  db.exec(`ALTER TABLE cart_items RENAME TO cart_items_old;`);
  db.exec(`
    CREATE TABLE cart_items (
      id TEXT PRIMARY KEY DEFAULT ('ci_' || lower(hex(randomblob(10)))),
      variant_id TEXT NOT NULL,
      qty INTEGER NOT NULL CHECK (qty > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON cart_items(variant_id);
  `);

  const oldRows = db.prepare(`SELECT id, product_id as productId, qty FROM cart_items_old`).all();
  const pickVariant = db.prepare(`
    SELECT id
    FROM product_variants
    WHERE product_id = ?
    ORDER BY stock DESC, id ASC
    LIMIT 1
  `);
  const insertNew = db.prepare(`INSERT OR REPLACE INTO cart_items (id, variant_id, qty) VALUES (?, ?, ?)`);

  const tx = db.transaction(() => {
    for (const row of oldRows) {
      const v = pickVariant.get(row.productId);
      if (!v) continue;
      insertNew.run(row.id || rid("ci_"), v.id, Math.max(1, Number(row.qty) || 1));
    }
  });

  tx();
  db.exec(`DROP TABLE cart_items_old;`);
}

function ensureOrdersSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      total INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'RUB',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const hasOrderItems = hasTable(db, "order_items");
  if (!hasOrderItems) {
    db.exec(`
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        variant_id TEXT,
        product_id TEXT NOT NULL,
        sku TEXT,
        size TEXT,
        color TEXT,
        title TEXT NOT NULL,
        price INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        line_total INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'RUB',
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    `);
    return;
  }

  const cols = tableColumns(db, "order_items");
  const needUpgrade = ["variant_id", "sku", "size", "color"].some((c) => !cols.includes(c));
  if (!needUpgrade) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`);
    return;
  }

  db.exec(`ALTER TABLE order_items RENAME TO order_items_old;`);
  db.exec(`
    CREATE TABLE order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      variant_id TEXT,
      product_id TEXT NOT NULL,
      sku TEXT,
      size TEXT,
      color TEXT,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'RUB',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);

  db.exec(`
    INSERT INTO order_items (id, order_id, product_id, title, price, qty, line_total, currency)
    SELECT id, order_id, product_id, title, price, qty, line_total, COALESCE(currency, 'RUB')
    FROM order_items_old;
    DROP TABLE order_items_old;
  `);
}

export function openDb() {
  ensureDir(DB_DIR);
  const isNew = !fs.existsSync(DB_FILE);

  const db = new Database(DB_FILE);
  db.pragma("foreign_keys = ON");

  ensureBaseSchema(db);
  ensureFavoritesTable(db);
  ensureCartSchema(db);
  ensureOrdersSchema(db);

  if (isNew) {
    seedCoreCatalog(db);
  }
  ensureDemoCatalog(db);

  return db;
}

function seedCoreCatalog(db) {
  const insCat = db.prepare(`INSERT OR IGNORE INTO categories (id, title) VALUES (?, ?)`);
  insCat.run("clothes", "Одежда");
  insCat.run("tech", "Техника");
  insCat.run("beauty", "Красота");
  insCat.run("home", "Дом");

  const insProduct = db.prepare(`
    INSERT OR IGNORE INTO products
    (id, title, description, price, brand, category_id, image, images,
     discount_percent, is_new, rating, reviews_count, popularity)
    VALUES
    (@id, @title, @description, @price, @brand, @category_id,
     @image, @images, @discount_percent, @is_new,
     @rating, @reviews_count, @popularity)
  `);

  const insVar = db.prepare(`
    INSERT OR IGNORE INTO product_variants
    (id, product_id, size, color, sku, stock)
    VALUES (@id, @product_id, @size, @color, @sku, @stock)
  `);

  const addProduct = (p, variants) => {
    insProduct.run({ ...p, images: JSON.stringify(p.images) });
    for (const v of variants) {
      insVar.run(v);
    }
  };

  addProduct(
    {
      id: "p_wb_hoodie_black",
      title: "Худи oversize базовое",
      description: "Плотный хлопок, мягкий начёс. Унисекс, свободная посадка.",
      price: 3990,
      brand: "WB Basics",
      category_id: "clothes",
      image: "/img/products/clothes/hoodie_1.png",
      images: [
        "/img/products/clothes/hoodie_1.png",
        "/img/products/clothes/hoodie_2.png",
        "/img/products/clothes/hoodie_3.png",
      ],
      discount_percent: 20,
      is_new: 1,
      rating: 4.8,
      reviews_count: 126,
      popularity: 980,
    },
    [
      { id: "v_wb_hoodie_black_s", product_id: "p_wb_hoodie_black", size: "S", color: "Черный", sku: "WB-HOODIE-S-BLK", stock: 14 },
      { id: "v_wb_hoodie_black_m", product_id: "p_wb_hoodie_black", size: "M", color: "Черный", sku: "WB-HOODIE-M-BLK", stock: 9 },
      { id: "v_wb_hoodie_white_l", product_id: "p_wb_hoodie_black", size: "L", color: "Белый", sku: "WB-HOODIE-L-WHT", stock: 2 },
    ]
  );

  addProduct(
    {
      id: "p_wb_tws_neo",
      title: "Наушники беспроводные TWS Neo",
      description: "Активное шумоподавление, 24 часа работы с кейсом и быстрый заряд.",
      price: 3290,
      brand: "Soundly",
      category_id: "tech",
      image: "/img/products/tech/headphones_1.png",
      images: ["/img/products/tech/headphones_1.png", "/img/products/tech/headphones_2.png"],
      discount_percent: 17,
      is_new: 0,
      rating: 4.7,
      reviews_count: 542,
      popularity: 1700,
    },
    [
      { id: "v_wb_tws_black", product_id: "p_wb_tws_neo", size: "Стандарт", color: "Черный", sku: "TWS-NEO-BLK", stock: 22 },
      { id: "v_wb_tws_white", product_id: "p_wb_tws_neo", size: "Стандарт", color: "Белый", sku: "TWS-NEO-WHT", stock: 12 },
    ]
  );

  addProduct(
    {
      id: "p_wb_cream_hydra",
      title: "Крем для лица увлажняющий Hydra",
      description: "Лёгкая текстура, гиалуроновая кислота и пантенол. Подходит для ежедневного ухода.",
      price: 990,
      brand: "SkinCare Lab",
      category_id: "beauty",
      image: "/img/products/beauty/cream_1.png",
      images: ["/img/products/beauty/cream_1.png", "/img/products/beauty/cream_2.png"],
      discount_percent: 0,
      is_new: 1,
      rating: 4.7,
      reviews_count: 88,
      popularity: 640,
    },
    [
      { id: "v_wb_cream_50", product_id: "p_wb_cream_hydra", size: "50 мл", color: "Без цвета", sku: "CREAM-HYDRA-50", stock: 31 },
      { id: "v_wb_cream_100", product_id: "p_wb_cream_hydra", size: "100 мл", color: "Без цвета", sku: "CREAM-HYDRA-100", stock: 12 },
    ]
  );

  addProduct(
    {
      id: "p_wb_blanket_soft",
      title: "Плед велсофт Premium",
      description: "Тёплый, мягкий и лёгкий плед для дома. Не электризуется, легко стирается.",
      price: 1490,
      brand: "Homey",
      category_id: "home",
      image: "/img/products/home/blanket_1.png",
      images: ["/img/products/home/blanket_1.png", "/img/products/home/blanket_2.png"],
      discount_percent: 10,
      is_new: 0,
      rating: 4.5,
      reviews_count: 210,
      popularity: 900,
    },
    [
      { id: "v_wb_blanket_pink", product_id: "p_wb_blanket_soft", size: "140x200", color: "Розовый", sku: "BLANKET-PRM-PNK", stock: 10 },
      { id: "v_wb_blanket_gray", product_id: "p_wb_blanket_soft", size: "200x220", color: "Серый", sku: "BLANKET-PRM-GRY", stock: 5 },
    ]
  );

  const hasReviews = db.prepare(`SELECT COUNT(*) as c FROM reviews`).get().c;
  if (!hasReviews) {
    const insReview = db.prepare(`
      INSERT INTO reviews (id, product_id, author, rating, text)
      VALUES (?, ?, ?, ?, ?)
    `);

    insReview.run(rid("r_"), "p_wb_hoodie_black", "Анна", 5, "Очень мягкое и тёплое, ношу каждый день.");
    insReview.run(rid("r_"), "p_wb_hoodie_black", "Илья", 4, "Хорошее качество ткани, слегка oversized.");
    insReview.run(rid("r_"), "p_wb_tws_neo", "Марина", 5, "Отличный звук за эту цену, кейс компактный.");
  }
}

function ensureDemoCatalog(db) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM products`).get().c;
  if (count >= 12) return;

  const insProduct = db.prepare(`
    INSERT OR IGNORE INTO products
    (id, title, description, price, brand, category_id, image, images,
     discount_percent, is_new, rating, reviews_count, popularity)
    VALUES
    (@id, @title, @description, @price, @brand, @category_id,
     @image, @images, @discount_percent, @is_new,
     @rating, @reviews_count, @popularity)
  `);

  const insVar = db.prepare(`
    INSERT OR IGNORE INTO product_variants
    (id, product_id, size, color, sku, stock)
    VALUES (@id, @product_id, @size, @color, @sku, @stock)
  `);

  const products = [
    {
      id: "p_wb_hoodie_light",
      title: "Худи oversize Light",
      description: "Базовая модель из футера без начёса. Подходит на весну и лето.",
      price: 3190,
      brand: "WB Basics",
      category_id: "clothes",
      image: "/img/products/clothes/hoodie_2.png",
      images: ["/img/products/clothes/hoodie_2.png", "/img/products/clothes/hoodie_3.png"],
      discount_percent: 12,
      is_new: 0,
      rating: 4.6,
      reviews_count: 74,
      popularity: 860,
      variants: [
        { id: "v_wb_hoodie_light_s", size: "S", color: "Бежевый", sku: "WB-HOODIE-LT-S-BGE", stock: 8 },
        { id: "v_wb_hoodie_light_m", size: "M", color: "Бежевый", sku: "WB-HOODIE-LT-M-BGE", stock: 12 },
        { id: "v_wb_hoodie_light_l", size: "L", color: "Графит", sku: "WB-HOODIE-LT-L-GRF", stock: 3 },
      ],
    },
    {
      id: "p_wb_hoodie_zip",
      title: "Толстовка на молнии Street",
      description: "Практичная модель с мягкой подкладкой и плотной молнией.",
      price: 4290,
      brand: "Urban Drop",
      category_id: "clothes",
      image: "/img/products/clothes/hoodie_3.png",
      images: ["/img/products/clothes/hoodie_3.png", "/img/products/clothes/hoodie_1.png"],
      discount_percent: 25,
      is_new: 1,
      rating: 4.9,
      reviews_count: 41,
      popularity: 1020,
      variants: [
        { id: "v_wb_zip_m", size: "M", color: "Черный", sku: "WB-ZIP-M-BLK", stock: 7 },
        { id: "v_wb_zip_l", size: "L", color: "Черный", sku: "WB-ZIP-L-BLK", stock: 1 },
      ],
    },
    {
      id: "p_wb_cream_night",
      title: "Крем ночной восстанавливающий",
      description: "Питательная формула с ниацинамидом и пептидами.",
      price: 1290,
      brand: "SkinCare Lab",
      category_id: "beauty",
      image: "/img/products/beauty/cream_2.png",
      images: ["/img/products/beauty/cream_2.png", "/img/products/beauty/cream_1.png"],
      discount_percent: 9,
      is_new: 0,
      rating: 4.8,
      reviews_count: 63,
      popularity: 730,
      variants: [
        { id: "v_wb_cream_night_50", size: "50 мл", color: "Без цвета", sku: "CREAM-NIGHT-50", stock: 19 },
        { id: "v_wb_cream_night_100", size: "100 мл", color: "Без цвета", sku: "CREAM-NIGHT-100", stock: 6 },
      ],
    },
    {
      id: "p_wb_headphones_pro",
      title: "Наушники TWS Pro Max",
      description: "Низкая задержка, прозрачный режим, сенсорное управление.",
      price: 4590,
      brand: "Soundly",
      category_id: "tech",
      image: "/img/products/tech/headphones_2.png",
      images: ["/img/products/tech/headphones_2.png", "/img/products/tech/headphones_1.png"],
      discount_percent: 14,
      is_new: 1,
      rating: 4.9,
      reviews_count: 304,
      popularity: 1880,
      variants: [
        { id: "v_wb_headphones_pro_blk", size: "Стандарт", color: "Черный", sku: "TWS-PRO-BLK", stock: 24 },
        { id: "v_wb_headphones_pro_white", size: "Стандарт", color: "Белый", sku: "TWS-PRO-WHT", stock: 11 },
      ],
    },
    {
      id: "p_wb_blanket_winter",
      title: "Плед Winter Touch",
      description: "Увеличенная плотность, мягкий ворс и аккуратная окантовка.",
      price: 2190,
      brand: "Homey",
      category_id: "home",
      image: "/img/products/home/blanket_2.png",
      images: ["/img/products/home/blanket_2.png", "/img/products/home/blanket_1.png"],
      discount_percent: 18,
      is_new: 1,
      rating: 4.7,
      reviews_count: 112,
      popularity: 1140,
      variants: [
        { id: "v_wb_blanket_winter_200", size: "200x220", color: "Лаванда", sku: "BLANKET-WTR-LAV", stock: 6 },
        { id: "v_wb_blanket_winter_240", size: "220x240", color: "Серый", sku: "BLANKET-WTR-GRY", stock: 4 },
      ],
    },
    {
      id: "p_wb_blanket_kids",
      title: "Плед Kids Soft",
      description: "Гипоаллергенный материал, подходит для детской комнаты.",
      price: 1290,
      brand: "Homey",
      category_id: "home",
      image: "/img/products/home/blanket_1.png",
      images: ["/img/products/home/blanket_1.png", "/img/products/home/blanket_2.png"],
      discount_percent: 0,
      is_new: 0,
      rating: 4.4,
      reviews_count: 35,
      popularity: 490,
      variants: [
        { id: "v_wb_blanket_kids_140", size: "110x140", color: "Розовый", sku: "BLANKET-KDS-PNK", stock: 15 },
      ],
    },
    {
      id: "p_wb_hoodie_warm",
      title: "Худи утепленное Arctic",
      description: "Плотный трикотаж с начёсом, высокий ворот и глубокий капюшон.",
      price: 4890,
      brand: "WB Basics",
      category_id: "clothes",
      image: "/img/products/clothes/hoodie_1.png",
      images: ["/img/products/clothes/hoodie_1.png", "/img/products/clothes/hoodie_2.png"],
      discount_percent: 11,
      is_new: 1,
      rating: 4.9,
      reviews_count: 87,
      popularity: 1360,
      variants: [
        { id: "v_wb_hoodie_warm_m", size: "M", color: "Графит", sku: "WB-ARCTIC-M-GRF", stock: 5 },
        { id: "v_wb_hoodie_warm_l", size: "L", color: "Графит", sku: "WB-ARCTIC-L-GRF", stock: 2 },
      ],
    },
    {
      id: "p_wb_headphones_lite",
      title: "Наушники TWS Lite",
      description: "Компактный кейс, стабильный BT 5.3 и удобная посадка.",
      price: 2290,
      brand: "Soundly",
      category_id: "tech",
      image: "/img/products/tech/headphones_1.png",
      images: ["/img/products/tech/headphones_1.png", "/img/products/tech/headphones_2.png"],
      discount_percent: 5,
      is_new: 0,
      rating: 4.5,
      reviews_count: 198,
      popularity: 980,
      variants: [
        { id: "v_wb_headphones_lite_black", size: "Стандарт", color: "Черный", sku: "TWS-LITE-BLK", stock: 27 },
      ],
    },
  ];

  const tx = db.transaction(() => {
    for (const p of products) {
      const { variants, ...product } = p;
      insProduct.run({ ...product, images: JSON.stringify(product.images) });
      for (const v of variants) {
        insVar.run({ ...v, product_id: product.id });
      }
    }
  });

  tx();
}
