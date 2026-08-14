import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import clsx from "clsx";

import type { Route } from "./+types/root";
import "~/styles/global.scss";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="brand" to="/" aria-label="Motivator — главная">
          Motivator
        </NavLink>
        <nav aria-label="Основная навигация">
          <NavLink
            to="/"
            className={({ isActive }) => clsx("nav-link", isActive && "nav-link--active")}
          >
            Главная
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) => clsx("nav-link", isActive && "nav-link--active")}
          >
            О проекте
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export function HydrateFallback() {
  return (
    <main className="loading-screen" aria-live="polite">
      <span className="loading-screen__mark" aria-hidden="true" />
      <p>Загружаем Motivator…</p>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Что-то пошло не так";
  let message = "Попробуйте обновить страницу.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Страница не найдена" : `Ошибка ${error.status}`;
    message = error.status === 404 ? "Проверьте адрес или вернитесь на главную." : error.statusText;
  }

  return (
    <main className="error-page">
      <p className="eyebrow">Ошибка</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <NavLink className="button" to="/">
        На главную
      </NavLink>
    </main>
  );
}
