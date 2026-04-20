-- =========================================
-- 002_product_variants.sql
-- Таблица вариантов товара (размер, цвет, SKU, stock)
-- =========================================

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,

  size TEXT,
  color TEXT,

  sku TEXT NOT NULL UNIQUE,
  stock INTEGER NOT NULL DEFAULT 0,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON product_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_sku
  ON product_variants(sku);