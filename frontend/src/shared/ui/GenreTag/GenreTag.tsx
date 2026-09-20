import React from "react";
import { X } from "lucide-react";
import styles from "./GenreTag.module.css";

interface IGenreTagProps {
  label: string;
  onRemove?: () => void;
}

export const GenreTag: React.FC<IGenreTagProps> = ({ label, onRemove }) => {
  return (
    <div className={`${styles.tag} ${onRemove ? styles.tagWithButton : ""}`}>
      {label}
      {onRemove && (
        <button className={styles.removeButton} onClick={onRemove} aria-label="Remove tag">
          <X size={17} />
        </button>
      )}
    </div>
  );
};
