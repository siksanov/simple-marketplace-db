import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API } from "../api.js";

function formatPrice(v) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(v));
}

export default function ProductCard({ p, onChanged }) {
  const [busy, setBusy] = useState(false);

  const { priceNew, priceOld, discount } = useMemo(() => {
    const disc = Number(p.discountPercent || p.discount_percent || 0);
    const base = Number(p.price);
    if (disc > 0) {
      const newPrice = Math.round(base * (1 - disc / 100));
      return { priceNew: newPrice, priceOld: base, discount: disc };
    }
    return { priceNew: base, priceOld: null, discount: 0 };
  }, [p]);

  const img = p.image || (Array.isArray(p.images) ? p.images[0] : null) || "/img/products/placeholder.svg";

  async function toggleFav() {
    if (busy) return;
    setBusy(true);
    try {
      if (p.isFavorite) await API.favRemove(p.id);
      else await API.favAdd(p.id);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card__media">
        <Link to={`/product/${p.id}`}>
          <img
            className="card__img"
            src={img}
            alt={p.title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "/img/products/placeholder.svg";
            }}
          />
        </Link>

        <button
          className={`fav ${p.isFavorite ? "fav--on" : ""}`}
          onClick={toggleFav}
          type="button"
          title="В избранное"
          aria-label="В избранное"
        >
          ♥
        </button>

        <div className="badges">
          {discount > 0 && <span className="badge badge--discount">-{discount}%</span>}
          {(p.isNew || p.is_new) ? <span className="badge badge--new">NEW</span> : null}
          {Number(p.stock) <= 0 ? <span className="badge badge--out">нет</span> : null}
        </div>
      </div>

      <div className="card__body">
        <div className="price">
          <span className="price__new">{formatPrice(priceNew)} ₽</span>
          {priceOld ? <span className="price__old">{formatPrice(priceOld)} ₽</span> : null}
        </div>

        <div className="meta">
          <span className="rating">★ {Number(p.rating || 0).toFixed(1)}</span>
          <span className="reviews">({p.reviewsCount || p.reviews_count || 0})</span>
        </div>

        <Link className="title" to={`/product/${p.id}`}>{p.title}</Link>
        <div className="sub">{p.brand}</div>
      </div>
    </div>
  );
}
