"use client";

import { useState } from "react";
import styles from "./Input.module.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
}

export function Input({ label, icon, error, hint, className = "", id, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className={`${styles.group} ${className}`}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <div className={`${styles.wrapper} ${focused ? styles.focused : ""} ${error ? styles.hasError : ""}`}>
        {icon && <div className={styles.icon}>{icon}</div>}
        <input
          id={id}
          className={`${styles.input} ${icon ? styles.withIcon : ""}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = "", id, ...props }: SelectProps) {
  const selectId = id || props.name;
  return (
    <div className={styles.group}>
      {label && <label htmlFor={selectId} className={styles.label}>{label}</label>}
      <div className={styles.selectWrapper}>
        <select id={selectId} className={`${styles.select} ${className}`} {...props}>
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <div className={styles.selectArrow}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </div>
    </div>
  );
}

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export function SearchInput({ className = "", ...props }: SearchInputProps) {
  return (
    <div className={`${styles.searchWrapper} ${className}`}>
      <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input className={styles.searchInput} {...props} />
    </div>
  );
}
