import { Link } from "react-router";
import { SideBarItem } from "~/components/SideBarItem/SideBarItem";

import type { Route } from "./+types/home";
import styles from "./home.module.scss";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Motivator — двигайся к важному" },
    {
      name: "description",
      content: "Стартовая страница проекта Motivator.",
    },
  ];
}

export default function Home() {
  return (
    <section className={styles.hero}>
      <SideBarItem
        value="66484"
        fontSize="50px"
        backgroundColor="transparent"
        borderColor="#963214"
        height="70px"
        width="40px"
      />
      <p className="eyebrow">Новый старт</p>
      <h1>
        Маленькие шаги.
        <br />
        Большие изменения.
      </h1>
      <p className={styles.lead}>
        Каркас готов. Теперь можно сосредоточиться на продукте, а не на
        настройке сборки.
      </p>
      <Link className="button" to="/about">
        Посмотреть структуру
      </Link>
    </section>
  );
}
