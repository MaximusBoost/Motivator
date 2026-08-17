import type { ReactNode } from "react";
import { NavLink } from "react-router";
import clsx from "clsx";

import { useAuth } from "~/features/auth/AuthProvider";
import styles from "./appShell.module.scss";

type AppShellProps = {
  children: ReactNode;
  username?: string;
  email?: string;
};

const navigation = [
  { to: "/", label: "Главная", end: true },
  { to: "/qualification", label: "Мой маршрут", end: true },
  { to: "/subjects", label: "Предметы" },
  { to: "/qualification/exam", label: "Пробное испытание" },
  { to: "/practice", label: "Практика" },
  { to: "/results", label: "Результаты" },
  { to: "/profile", label: "Профиль" },
] as const;

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      className={clsx(styles.navigation, mobile && styles.mobileNavigation)}
      aria-label="Основная навигация"
    >
      {navigation.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={"end" in item ? item.end : false}
          className={({ isActive }) =>
            clsx(styles.navigationLink, isActive && styles.activeLink)
          }
        >
          <span className={styles.navigationMarker} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({
  children,
  username,
  email,
}: AppShellProps) {
  const { user } = useAuth();
  const resolvedUsername = username ?? user?.username ?? "Курсант";
  const resolvedEmail = email ?? user?.email ?? "demo@motivator.local";
  const initial = resolvedUsername.trim().charAt(0).toLocaleUpperCase("ru") || "К";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink className={styles.brand} to="/" aria-label="Motivator — главная">
          <span className={styles.brandMark} aria-hidden="true">M</span>
          <span>Motivator</span>
        </NavLink>

        <Navigation />

        <NavLink className={styles.user} to="/profile">
          <span className={styles.avatar} aria-hidden="true">{initial}</span>
          <span className={styles.userCopy}>
            <strong>{resolvedUsername}</strong>
            <small>{resolvedEmail}</small>
          </span>
        </NavLink>
      </aside>

      <header className={styles.mobileHeader}>
        <NavLink className={styles.mobileBrand} to="/">
          <span className={styles.brandMark} aria-hidden="true">M</span>
          <span>Motivator</span>
        </NavLink>

        <details className={styles.menu}>
          <summary>Меню</summary>
          <div className={styles.menuPanel}>
            <Navigation mobile />
          </div>
        </details>
      </header>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
