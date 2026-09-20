import React from "react";
import styles from "./AuthLayout.module.css";

interface IAuthLayoutProps {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<IAuthLayoutProps> = ({
  title,
  subtitle,
  footer,
  children,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {children}
        <p className={styles.footer}>{footer}</p>
      </div>
    </div>
  );
};
