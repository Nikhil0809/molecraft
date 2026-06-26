"use client";

import { useEffect, useState } from "react";
import styles from "./LoadingScreen.module.css";
import { RotatingLogo } from "./RotatingLogo";

interface LoadingScreenProps {
  text?: string;
}

export function LoadingScreen({ text = "Initializing Neural Workspace" }: LoadingScreenProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % 4);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.logoArea}>
          <RotatingLogo size={80} baseDuration={20} clockwise />
        </div>

        <div className={styles.textArea}>
          <p className={styles.title}>
            MoleCraft <span className={styles.v5}>v5</span>
          </p>
          <p className={styles.subtitle}>Neural Workspace</p>
        </div>

        <div className={styles.progressTrack}>
          <div className={`${styles.progressBar} ${styles[`phase${phase}`]}`} />
        </div>

        <p className={styles.status}>
          {phase === 0 && text}
          {phase === 1 && "Spawning molecular canvas..."}
          {phase === 2 && "Calibrating neural pathways..."}
          {phase === 3 && "Loading your workspace..."}
        </p>
      </div>
    </div>
  );
}
