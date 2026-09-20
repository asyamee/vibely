import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Страница не найдена</h1>
      <p className={styles.message}>
        Кажется, такой страницы нет или она больше не доступна.
      </p>
      <Link href="/" className={styles.link}>
        Вернуться на главную
      </Link>
    </div>
  );
}
