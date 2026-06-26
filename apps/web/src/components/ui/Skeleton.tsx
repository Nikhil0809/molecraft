import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  variant?: "text" | "circle" | "rect" | "card";
}

export function Skeleton({ width, height, borderRadius, className = "", variant = "text" }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;
  if (borderRadius) style.borderRadius = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

  return (
    <div
      className={`${styles.skeleton} ${styles[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <Skeleton variant="rect" height={120} />
      <Skeleton width="60%" />
      <Skeleton width="80%" />
      <Skeleton width="40%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className={styles.table}>
      <Skeleton variant="rect" height={40} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row}>
          <Skeleton width="30%" />
          <Skeleton width="20%" />
          <Skeleton width="25%" />
          <Skeleton width="15%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <Skeleton width={width} />;
}
