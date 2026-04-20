import React, { useEffect, useMemo, useState } from "react";
import { API } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import { Link } from "react-router-dom";

export default function HomePage() {
  const [cats, setCats] = useState([]);
  const [popular, setPopular] = useState(null);
  const [newest, setNewest] = useState(null);
  const [bestPrice, setBestPrice] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setErr("");
      const [categoriesRes, popularRes, newestRes, bestPriceRes] = await Promise.all([
        API.categories(),
        API.products({ sort: "popular", page: 1, limit: 12 }),
        API.products({ sort: "newest", page: 1, limit: 12 }),
        API.products({ sort: "price_asc", page: 1, limit: 12, inStock: 1 }),
      ]);

      setCats(categoriesRes.items || []);
      setPopular(popularRes);
      setNewest(newestRes);
      setBestPrice(bestPriceRes);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const topBrands = useMemo(() => {
    if (!popular?.items?.length) return [];

    const byCount = new Map();
    for (const item of popular.items) {
      byCount.set(item.brand, (byCount.get(item.brand) || 0) + 1);
    }

    return Array.from(byCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([brand]) => brand);
  }, [popular]);

  if (err) return <div className="error">Ошибка: {err}</div>;
  if (!popular || !newest || !bestPrice) return <div className="loading">Загрузка…</div>;

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <h1>Миллионы товаров. Быстрая доставка. Выгодные цены.</h1>
          <p>Демо UI в стилистике маркетплейса: категории, фильтры, карточка товара, отзывы, варианты и корзина.</p>
          <div className="hero__actions">
            <Link className="btn" to="/catalog">Перейти в каталог</Link>
            <Link className="btn btn--secondary" to="/catalog?sort=price_asc&inStock=1">Лучшие цены</Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="sectionTitle">Категории</h2>
        <div className="chips">
          {cats.map((x) => (
            <Link key={x.id} className="chip" to={`/catalog?categoryId=${encodeURIComponent(x.id)}`}>
              {x.title}
            </Link>
          ))}
        </div>
      </section>

      {topBrands.length > 0 && (
        <section>
          <h2 className="sectionTitle">Популярные бренды</h2>
          <div className="chips">
            {topBrands.map((brand) => (
              <Link key={brand} className="chip" to={`/catalog?brand=${encodeURIComponent(brand)}`}>
                {brand}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="sectionTitle">Хиты продаж</h2>
        <div className="grid">
          {popular.items.map((p) => <ProductCard key={p.id} p={p} onChanged={load} />)}
        </div>
      </section>

      <section>
        <h2 className="sectionTitle">Новинки</h2>
        <div className="grid">
          {newest.items.map((p) => <ProductCard key={p.id} p={p} onChanged={load} />)}
        </div>
      </section>

      <section>
        <h2 className="sectionTitle">Выгодные предложения</h2>
        <div className="grid">
          {bestPrice.items.map((p) => <ProductCard key={p.id} p={p} onChanged={load} />)}
        </div>
      </section>
    </div>
  );
}
