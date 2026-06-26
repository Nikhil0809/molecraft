"use client";

import styles from "./Button.module.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  href?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  href,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const cls = `${styles.btn} ${styles[variant]} ${styles[size]} ${className}`;

  const content = (
    <>
      {loading && <span className={styles.spinner} />}
      {icon && !loading && <span className={styles.icon}>{icon}</span>}
      {children && <span>{children}</span>}
    </>
  );

  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}
