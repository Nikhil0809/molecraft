"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function ErrorPage() {
  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />
      <div className={styles.inner}>
        <div className={styles.code}>500</div>
        <h1 className={styles.title}>Server Error</h1>
        <p className={styles.desc}>Our molecular analysis engine encountered an unexpected issue.</p>
        <div className={styles.actions}>
          <button onClick={() => window.location.reload()} className={styles.btn}>Retry Operation</button>
          <Link href="/dashboard" className={styles.btnSecondary}>Return to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
