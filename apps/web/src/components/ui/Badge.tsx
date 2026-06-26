import styles from "./Badge.module.css";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "purple" | "cyan" | "green" | "amber" | "red" | "brand";
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
