"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, ListMusic, UserRound } from "lucide-react";
import styles from "./AppShell.module.css";

const HIDDEN_ROUTES = ["/login", "/register"];

const TABS = [
  { href: "/", label: "Лента", icon: Home },
  { href: "/notifications", label: "Уведомления", icon: Bell },
  { href: "/playlists", label: "Плейлисты", icon: ListMusic },
  { href: "/profile", label: "Профиль", icon: UserRound },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() || "/";
  const hidden = HIDDEN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (hidden) return <>{children}</>;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>Vibely</Link>
        <nav className={styles.headerNav}>
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.headerLink} ${isActive(href) ? styles.headerLinkActive : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </header>

      <main className={styles.main}>{children}</main>

      <nav className={styles.tabbar}>
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.tab} ${isActive(href) ? styles.tabActive : ""}`}
          >
            <Icon size={22} />
            <span className={styles.tabLabel}>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
