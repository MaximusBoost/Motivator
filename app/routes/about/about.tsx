import { Button } from "~/secondApp/components/Button/Button";
import type { Route } from "./+types/about";
import styles from "./about.module.scss";
import { IconArea } from "~/secondApp/components/IconArea/IconArea";
import { ContinueCard } from "~/secondApp/components/ContinueCard/ContinueCard";

export function meta({}: Route.MetaArgs) {
  return [{ title: "О проекте | Motivator" }];
}

const layers = [
  ["app/routes", "Страницы, маршруты и их серверные загрузчики"],
  ["app/features", "Законченные пользовательские сценарии"],
  ["app/components", "Общие составные компоненты интерфейса"],
  ["app/ui", "Небольшие переиспользуемые UI-примитивы"],
  ["app/lib", "Утилиты, API-клиент и инфраструктурный код"],
];

export default function About() {
  return (
    <section className={styles.page}>
      <p className="eyebrow">Архитектура</p>
      <h1>Простая структура, которая растёт вместе с проектом.</h1>
      <ContinueCard/>
      <div className={styles.grid}>
        {layers.map(([name, description]) => (
          <article className={styles.card} key={name}>
            <code>{name}</code>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
