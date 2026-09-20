import React from "react";
import styles from "./Input.module.css";

type TInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, TInputProps>((props, ref) => {
  return <input ref={ref} className={styles.input} {...props} />;
});

Input.displayName = "Input";
