import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />
      <div className={styles.inner}>
        <div className={styles.code}>404</div>
        <h1 className={styles.title}>Page Not Found</h1>
        <p className={styles.desc}>This molecular structure doesn&apos;t exist in our workspace.</p>
        <Link href="/dashboard" className={styles.btn}>Return to Dashboard</Link>
      </div>
    </div>
  );
}
