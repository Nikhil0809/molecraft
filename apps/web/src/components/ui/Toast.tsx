"use client";

import { useEffect, useState } from "react";
import styles from "./Toast.module.css";

interface ToastData {
  id: string;
  title: string;
  description?: string;
  type?: "success" | "error" | "info" | "warning";
}

let toastListeners: Array<(t: ToastData) => void> = [];
let counter = 0;

export function toast(data: Omit<ToastData, "id">) {
  const id = `toast-${++counter}`;
  toastListeners.forEach((fn) => fn({ ...data, id }));
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastData[]>([]);

  useEffect(() => {
    const handler = (t: ToastData) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((x) => x !== handler);
    };
  }, []);

  return (
    <div className={styles.container} aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type || "info"]}`}>
          <div className={styles.indicator} />
          <div className={styles.content}>
            <p className={styles.title}>{t.title}</p>
            {t.description && <p className={styles.desc}>{t.description}</p>}
          </div>
          <button className={styles.close} onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
