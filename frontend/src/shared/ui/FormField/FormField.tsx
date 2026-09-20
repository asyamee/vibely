import React from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Input } from "@/shared/ui/Input/Input";
import styles from "./FormField.module.css";

interface IFormFieldProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  type?: string;
  placeholder?: string;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}

export function FormField<T extends FieldValues>({
  name,
  control,
  label,
  type = "text",
  placeholder,
  error,
  inputMode,
  autoComplete,
}: IFormFieldProps<T>) {
  return (
    <div className={styles.formGroup}>
      {label && (
        <label htmlFor={name} className={styles.label}>
          {label}
        </label>
      )}
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <>
            <Input id={name} type={type} placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete} {...field} />
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}
      />
    </div>
  );
}
