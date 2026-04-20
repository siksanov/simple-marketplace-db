INSERT OR IGNORE INTO categories (id, title) VALUES
('c1','Одежда'),
('c2','Обувь'),
('c3','Дом'),
('c4','Красота'),
('c5','Электроника');

INSERT OR IGNORE INTO products
(id, title, description, image, price, currency, stock, category_id, brand, rating, reviews_count, popularity)
VALUES
('p1','Футболка базовая','Плотный хлопок, базовая посадка.','https://unsplash.com/photos/a-man-with-a-beard-wGWxjnq0gI40',1290,'RUB',18,'c1','BasicLab',4.6,321,950),
('p2','Кроссовки белые','Универсальные, мягкая стелька.','https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',3990,'RUB',9,'c2','Run&Go',4.7,128,870),
('p3','Свеча ароматическая','Ваниль и сандал, 200 мл.','https://unsplash.com/photos/person-holding-lighted-candle-near-green-plant-OAW0OCLn52I',790,'RUB',25,'c3','HomeMood',4.4,76,430),
('p4','Крем для рук','Быстро впитывается, без липкости.','https://unsplash.com/photos/yellow-and-black-tube-bottle-6fz3ajqj88c',490,'RUB',0,'c4','CareMe',4.5,210,500),
('p5','Наушники беспроводные','BT, микрофон, кейс-зарядка.','https://unsplash.com/photos/black-wireless-headphones-on-white-table-lUMj2Zv5HUE',2990,'RUB',14,'c5','Soundy',4.3,542,1200),
('p6','Худи oversize','Теплый флис внутри.','https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1200&q=80',3490,'RUB',6,'c1','BasicLab',4.8,98,770),
('p7','Тапочки домашние','Мягкие, нескользящая подошва.','https://unsplash.com/photos/black-and-yellow-nike-slide-sandals-K_gIPI791Jo0',990,'RUB',33,'c3','HomeMood',4.2,54,300);

INSERT INTO product_variants (id, product_id, size, color, sku, stock)
VALUES
  ('v1', 'p1', 'S', 'Black', 'WB-TEE-0001-S-BLK', 12),
  ('v2', 'p1', 'M', 'Black', 'WB-TEE-0001-M-BLK', 5),
  ('v3', 'p1', 'L', 'Black', 'WB-TEE-0001-L-BLK', 0),
  ('v4', 'p1', 'M', 'White', 'WB-TEE-0001-M-WHT', 7);