import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API } from "../api.js";

function formatPrice(v) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(v));
}

export default function CartPage() {
  const [cart, setCart] = useState(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      setErr("");
      const x = await API.cart();
      setCart(x);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setQty(itemId, qty) {
    try {
      setBusyId(itemId);
      await API.cartUpdate(itemId, qty);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId("");
    }
  }

  async function remove(itemId) {
    try {
      setBusyId(itemId);
      await API.cartRemove(itemId);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId("");
    }
  }

  if (err) return <div className="error">Ошибка: {err}</div>;
  if (!cart) return <div className="loading">Загрузка…</div>;

  return (
    <div className="stack">
      <h1>Корзина</h1>
      {cart.items.length === 0 ? (
        <div className="emptyState">
          <h3>В корзине пока пусто</h3>
          <p>Добавьте товары из каталога, чтобы оформить заказ.</p>
          <Link className="btn btn--ghost" to="/catalog">Выбрать товары</Link>
        </div>
      ) : (
        <>
          <div className="cart">
            {cart.items.map((it) => {
              const isBusy = busyId === it.id;
              return (
                <div key={it.id} className="cartRow">
                  <div className="cartRow__title">
                    <img src={it.image || "/img/products/placeholder.svg"} alt={it.title} />
                    <div>
                      <b>{it.title}</b>
                      <div className="muted cartRow__sku">{it.color} / {it.size}</div>
                    </div>
                  </div>
                  <div className="cartRow__price">{formatPrice(it.price)} ₽</div>
                  <div className="cartRow__qty">
                    <button type="button" disabled={isBusy} onClick={() => setQty(it.id, Math.max(0, it.qty - 1))}>-</button>
                    <span>{it.qty}</span>
                    <button type="button" disabled={isBusy} onClick={() => setQty(it.id, it.qty + 1)}>+</button>
                  </div>
                  <div className="cartRow__sum">{formatPrice(it.lineTotal)} ₽</div>
                  <button className="link" type="button" disabled={isBusy} onClick={() => remove(it.id)}>Удалить</button>
                </div>
              );
            })}
          </div>

          <div className="cartTotal">
            <b>Итого:</b> {formatPrice(cart.total)} ₽
          </div>
        </>
      )}
    </div>
  );
}
