import Link from "next/link";
import styles from "./page.module.css";

export default function ForbiddenPage() {
  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />
      <div className={styles.inner}>
        <div className={styles.code}>403</div>
        <h1 className={styles.title}>Access Denied</h1>
        <p className={styles.desc}>You don&apos;t have the required security clearance for this molecular analysis.</p>
        <Link href="/dashboard" className={styles.btn}>Return to Dashboard</Link>
      </div>
    </div>
  );
}
