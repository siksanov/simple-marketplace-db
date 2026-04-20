import React from "react";
import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";

export default function Layout() {
  const navigate = useNavigate();

  function onSearchSubmit(e) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim() || "";
    navigate(`/catalog?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <Link className="brand" to="/" aria-label="Wildberries">
            <span className="brand__dot" />
            <span className="brand__name">wildberries</span>
          </Link>

          <form className="search" onSubmit={onSearchSubmit}>
            <input name="q" className="search__input" placeholder="Я ищу в Wildberries" />
            <button className="search__btn" type="submit">Найти</button>
          </form>

          <nav className="nav">
            <NavLink className="nav__link" to="/catalog">Каталог</NavLink>
            <NavLink className="nav__link" to="/favorites">Избранное</NavLink>
            <NavLink className="nav__link" to="/cart">Корзина</NavLink>
          </nav>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container footer__inner">Демо витрина Wildberries: каталог, карточка товара, корзина, избранное</div>
      </footer>
    </div>
  );
}
