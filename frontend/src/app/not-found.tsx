import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "80px 20px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 32, margin: 0, color: "var(--color-text)" }}>Страница не найдена</h1>
      <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
        Кажется, такой страницы нет или она больше не доступна.
      </p>
      <Link
        href="/"
        style={{
          color: "var(--color-accent)",
          textDecoration: "none",
          fontWeight: 500,
          marginTop: 8,
        }}
      >
        Вернуться на главную
      </Link>
    </div>
  );
}
