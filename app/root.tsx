import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { AuthProvider } from "~/features/auth/AuthProvider";

import "./styles/global.scss";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
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
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export function HydrateFallback() {
  return null;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Произошла ошибка";
  let message = "Попробуйте обновить страницу.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Страница не найдена" : `Ошибка ${error.status}`;
    message = error.statusText || message;
  }

  return (
    <main style={{ padding: "32px" }}>
      <h1>{title}</h1>
      <p>{message}</p>
    </main>
  );
}
