import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useAuth } from "./AuthProvider";
import styles from "./requireAuth.module.scss";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className={styles.loading}>Загружаем профиль…</div>;
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
