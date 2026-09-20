import styles from "./Loader.module.css";

export const Loader: React.FC = () => (
  <div className={styles.container}>
    <div className={styles.spinner} />
  </div>
);
