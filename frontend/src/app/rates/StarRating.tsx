import styles from "../page.module.css";

type Props = {
  value: number | undefined;
  onChange: (s: 1 | 2 | 3 | 4 | 5) => void;
};

export const StarRating = ({ value, onChange }: Props) => {
  return (
    <div className={styles.stars}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          className={
            value && value >= s
              ? `${styles.starButton} ${styles.starButtonActive}`
              : styles.starButton
          }
          onClick={() => onChange(s as 1 | 2 | 3 | 4 | 5)}
        >
          {s}
        </button>
      ))}
    </div>
  );
};

