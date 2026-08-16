import type { ReactNode } from "react";
import { Link } from "react-router";

import styles from "./auth.module.scss";

type AuthLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.brand} to="/" aria-label="Motivator — главная">
          <span aria-hidden="true">M</span>
          Motivator
        </Link>

        <header className={styles.header}>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        {children}
        <div className={styles.footer}>{footer}</div>
      </section>
    </main>
  );
}
