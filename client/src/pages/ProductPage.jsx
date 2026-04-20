import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";

function formatPrice(v) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(v));
}

export default function ProductPage() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [recs, setRecs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [err, setErr] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const [activeImg, setActiveImg] = useState("");

  // variant selection
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const selectedVariant = useMemo(() => {
    if (!p?.variants?.length) return null;
    return p.variants.find((v) => (color ? v.color === color : true) && (size ? v.size === size : true)) || null;
  }, [p, color, size]);

  const images = useMemo(() => {
    if (!p) return [];
    if (Array.isArray(p.images)) return p.images;
    return p.image ? [p.image] : [];
  }, [p]);

  const availableColors = useMemo(() => {
    if (!p?.variants?.length) return [];
    return Array.from(new Set(p.variants.map((v) => v.color || "Default")));
  }, [p]);

  const availableSizes = useMemo(() => {
    if (!p?.variants?.length) return [];
    const filtered = p.variants.filter((v) => (color ? v.color === color : true));
    return Array.from(new Set(filtered.map((v) => v.size || "One size")));
  }, [p, color]);

  async function load() {
    setErr("");
    setActionMsg("");
    const prod = await API.product(id);
    setP(prod);

    const firstImg = (prod.images && Array.isArray(prod.images) && prod.images[0]) || prod.image || "";
    setActiveImg(firstImg);

    // выставим дефолтные селекты по первому варианту
    if (prod.variants?.length) {
      const v0 = prod.variants[0];
      setColor(v0.color || "Default");
      setSize(v0.size || "One size");
    }

    // отзывы + рекомендации
    try {
      const [rv, rc] = await Promise.all([API.reviews(id), API.recommendations(id)]);
      setReviews(rv.items || []);
      setRecs(rc.items || []);
    } catch {
      setReviews([]);
      setRecs([]);
    }
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addToCart() {
    if (!selectedVariant) {
      setActionMsg("Выберите вариант товара перед добавлением в корзину.");
      return;
    }
    if (selectedVariant.stock <= 0) return;

    await API.cartAdd(selectedVariant.id, 1);
    setActionMsg("Товар добавлен в корзину.");
  }

  async function submitReview(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      author: (fd.get("author") || "").toString().trim() || "Anon",
      rating: Number(fd.get("rating") || 5),
      text: (fd.get("text") || "").toString().trim(),
    };
    await API.reviewAdd(id, payload);
    e.currentTarget.reset();
    setActionMsg("Спасибо! Отзыв опубликован.");
    await load();
  }

  if (err) return <div className="error">Ошибка: {err}</div>;
  if (!p) return <div className="loading">Загрузка…</div>;

  const discount = Number(p.discountPercent || p.discount_percent || 0);
  const base = Number(p.price);
  const newPrice = discount > 0 ? Math.round(base * (1 - discount / 100)) : base;

  const stockLabel = selectedVariant ? selectedVariant.stock : null;

  return (
    <div className="pdp">
      <div className="pdp__left">
        <div className="gallery">
          <div className="thumbs">
            {images.map((src) => (
              <button
                key={src}
                className={`thumb ${src === activeImg ? "thumb--on" : ""}`}
                onClick={() => setActiveImg(src)}
                type="button"
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>

          <div className="mainImg">
            <img
              src={activeImg || images[0] || "/img/products/placeholder.svg"}
              alt={p.title}
              onError={(e) => {
                e.currentTarget.src = "/img/products/placeholder.svg";
              }}
            />
          </div>
        </div>
      </div>

      <div className="pdp__right">
        <h1 className="pdp__title">{p.title}</h1>

        <div className="pdp__meta">
          <span>★ {Number(p.rating || 0).toFixed(1)}</span>
          <span>({p.reviewsCount || p.reviews_count || 0})</span>
          <span className="dot">•</span>
          <span>{p.brand}</span>
        </div>

        <div className="pdp__price">
          <span className="price__new">{formatPrice(newPrice)} ₽</span>
          {discount > 0 ? <span className="price__old">{formatPrice(base)} ₽</span> : null}
          {discount > 0 ? <span className="badge badge--discount">-{discount}%</span> : null}
        </div>

        {/* Variants */}
        <div className="pdp__block">
          <h3>Варианты</h3>

          <div className="variantRow">
            <div className="muted">Цвет</div>
            <div className="chips">
              {availableColors.map((c) => (
                <button
                  key={c}
                  className={`chipBtn ${c === color ? "chipBtn--on" : ""}`}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    // сбросим размер на первый доступный под цвет
                    const sizes = Array.from(
                      new Set(p.variants.filter((v) => v.color === c).map((v) => v.size || "One size"))
                    );
                    setSize(sizes[0] || "");
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="variantRow">
            <div className="muted">Размер</div>
            <div className="chips">
              {availableSizes.map((s) => {
                const v = p.variants.find((x) => (x.color || "Default") === color && (x.size || "One size") === s);
                const disabled = !v || v.stock <= 0;
                return (
                  <button
                    key={s}
                    className={`chipBtn ${s === size ? "chipBtn--on" : ""}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSize(s)}
                    title={disabled ? "Нет в наличии" : "Выбрать"}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedVariant ? (
            <div className="variantInfo">
              <div className="muted">SKU: <b>{selectedVariant.sku}</b></div>
              <div className="muted">
                Остаток:{" "}
                <b style={{ color: selectedVariant.stock > 0 ? "inherit" : "#ff1a1a" }}>
                  {selectedVariant.stock}
                </b>
              </div>
            </div>
          ) : (
            <div className="muted">Выберите вариант</div>
          )}
        </div>

        <button className="btn" onClick={addToCart} disabled={!selectedVariant || selectedVariant.stock <= 0}>
          {!selectedVariant ? "Выберите вариант" : stockLabel <= 0 ? "Нет в наличии" : "В корзину"}
        </button>
        {actionMsg ? <div className="note">{actionMsg}</div> : null}

        <div className="pdp__block">
          <h3>Описание</h3>
          <p className="muted">{p.description || "—"}</p>
        </div>

        <div className="pdp__block">
          <h3>Отзывы</h3>

          {reviews.length === 0 ? (
            <div className="muted">Пока нет отзывов</div>
          ) : (
            <div className="reviews">
              {reviews.map((r) => (
                <div key={r.id} className="review">
                  <div className="review__top">
                    <b>{r.author}</b>
                    <span>★ {r.rating}</span>
                  </div>
                  <div className="muted">{r.text}</div>
                </div>
              ))}
            </div>
          )}

          <form className="reviewForm" onSubmit={submitReview}>
            <div className="row">
              <input name="author" placeholder="Ваше имя" />
              <select name="rating" defaultValue="5">
                <option value="5">5</option><option value="4">4</option><option value="3">3</option>
                <option value="2">2</option><option value="1">1</option>
              </select>
            </div>
            <textarea name="text" placeholder="Текст отзыва" rows={3} />
            <button className="btn btn--ghost" type="submit">Оставить отзыв</button>
          </form>
        </div>
      </div>

      {recs.length > 0 && (
        <section className="pdp__recs">
          <h2 className="sectionTitle">Похожие / с этим покупают</h2>
          <div className="grid">
            {recs.map((x) => <ProductCard key={x.id} p={x} onChanged={load} />)}
          </div>
        </section>
      )}
    </div>
  );
}
