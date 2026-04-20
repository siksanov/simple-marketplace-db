import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import { useSearchParams } from "react-router-dom";

export default function CatalogPage() {
  const [sp, setSp] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const params = useMemo(() => ({
    q: sp.get("q") || "",
    categoryId: sp.get("categoryId") || "",
    brand: sp.get("brand") || "",
    inStock: sp.get("inStock") || "",
    minPrice: sp.get("minPrice") || "",
    maxPrice: sp.get("maxPrice") || "",
    sort: sp.get("sort") || "popular",
    page: Number(sp.get("page") || 1),
    limit: 12,
  }), [sp]);

  const load = useCallback(async () => {
    try {
      setErr("");
      const [categoriesRes, brandsRes, productsRes] = await Promise.all([
        API.categories(),
        API.brands(),
        API.products(params),
      ]);

      setCats(categoriesRes.items || []);
      setBrands(brandsRes.items || []);
      setData(productsRes);
    } catch (e) {
      setErr(e.message);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  function setField(k, v) {
    const next = new URLSearchParams(sp);
    if (!v) next.delete(k);
    else next.set(k, v);
    next.set("page", "1");
    setSp(next);
  }

  function resetFilters() {
    const next = new URLSearchParams();
    if (params.q) next.set("q", params.q);
    next.set("sort", params.sort);
    setSp(next);
  }

  function goPage(page) {
    const next = new URLSearchParams(sp);
    next.set("page", String(page));
    setSp(next);
  }

  const hasFilters = Boolean(params.categoryId || params.brand || params.inStock || params.minPrice || params.maxPrice);

  if (err) return <div className="error">Ошибка: {err}</div>;
  if (!data) return <div className="loading">Загрузка…</div>;

  return (
    <div className="catalogWrap stack">
      <div className="catalogHead">
        <h1 className="catalogHead__title">Каталог</h1>
        <p className="catalogHead__sub">
          {params.q ? `Поиск: «${params.q}»` : "Подберите товары по категориям, брендам и цене"}
        </p>
      </div>

      <div className="catalog">
        <aside className="filters">
          <div className="filters__header">
            <div className="filters__title">Фильтры</div>
            {hasFilters ? (
              <button className="link" type="button" onClick={resetFilters}>Сбросить</button>
            ) : null}
          </div>

          <label className="field">
            <span>Категория</span>
            <select value={params.categoryId} onChange={(e) => setField("categoryId", e.target.value)}>
              <option value="">Все</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Бренд</span>
            <select value={params.brand} onChange={(e) => setField("brand", e.target.value)}>
              <option value="">Все</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>

          <label className="field field--row">
            <span>Только в наличии</span>
            <input
              type="checkbox"
              checked={params.inStock === "1"}
              onChange={(e) => setField("inStock", e.target.checked ? "1" : "")}
            />
          </label>

          <div className="fieldGroup">
            <label className="field">
              <span>Цена от</span>
              <input
                type="number"
                min="0"
                value={params.minPrice}
                onChange={(e) => setField("minPrice", e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>до</span>
              <input
                type="number"
                min="0"
                value={params.maxPrice}
                onChange={(e) => setField("maxPrice", e.target.value)}
                placeholder="99999"
              />
            </label>
          </div>
        </aside>

        <section className="results">
          <div className="results__bar">
            <div className="results__count">Найдено: {data.total}</div>
            <select value={params.sort} onChange={(e) => setField("sort", e.target.value)}>
              <option value="popular">Популярное</option>
              <option value="newest">Новинки</option>
              <option value="rating">По рейтингу</option>
              <option value="price_asc">Цена ↑</option>
              <option value="price_desc">Цена ↓</option>
            </select>
          </div>

          {data.items.length === 0 ? (
            <div className="emptyState">
              <h3>По вашему запросу ничего не найдено</h3>
              <p>Попробуйте убрать часть фильтров или изменить поисковую фразу.</p>
              <button className="btn btn--ghost" type="button" onClick={resetFilters}>Сбросить фильтры</button>
            </div>
          ) : (
            <>
              <div className="grid">
                {data.items.map((p) => <ProductCard key={p.id} p={p} onChanged={load} />)}
              </div>

              <div className="pager">
                <button className="btn btn--ghost" disabled={data.page <= 1} onClick={() => goPage(data.page - 1)}>
                  Назад
                </button>
                <div className="pager__info">Стр. {data.page} / {data.totalPages}</div>
                <button className="btn btn--ghost" disabled={data.page >= data.totalPages} onClick={() => goPage(data.page + 1)}>
                  Вперёд
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
