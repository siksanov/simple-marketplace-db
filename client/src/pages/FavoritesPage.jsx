import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";

export default function FavoritesPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setErr("");
      const res = await API.favorites();
      setData(res);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (err) return <div className="error">Ошибка: {err}</div>;
  if (!data) return <div className="loading">Загрузка…</div>;

  return (
    <div className="stack">
      <h1>Избранное</h1>
      {data.items.length === 0 ? (
        <div className="emptyState">
          <h3>В избранном пока ничего нет</h3>
          <p>Добавляйте товары сердечком на карточке, чтобы быстро к ним вернуться.</p>
          <Link className="btn btn--ghost" to="/catalog">Открыть каталог</Link>
        </div>
      ) : (
        <div className="grid">
          {data.items.map((p) => <ProductCard key={p.id} p={p} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}
