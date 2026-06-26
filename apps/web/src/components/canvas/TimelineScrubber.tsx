"use client";

import { useState, useCallback } from "react";
import styles from "./TimelineScrubber.module.css";

interface TimelineScrubberProps {
  totalHours?: number;
  onChange?: (hour: number) => void;
  markers?: { hour: number; label: string }[];
}

export function TimelineScrubber({ totalHours = 24, onChange, markers }: TimelineScrubberProps) {
  const [currentHour, setCurrentHour] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setCurrentHour(val);
      onChange?.(val);
    },
    [onChange]
  );

  const progress = (currentHour / totalHours) * 100;

  return (
    <div className={`${styles.container} ${isDragging ? styles.active : ""}`}>
      <div className={styles.header}>
        <span className={styles.label}>Temporal Chemistry</span>
        <span className={styles.time}>{currentHour}h / {totalHours}h</span>
      </div>
      <div className={styles.track}>
        <input
          type="range"
          min={0}
          max={totalHours}
          step={0.5}
          value={currentHour}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          className={styles.slider}
          aria-label="Timeline scrubber"
        />
        <div className={styles.trackBg}>
          <div className={styles.trackFill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.thumb} style={{ left: `${progress}%` }} />
        <div className={styles.markers}>
          {markers?.map((m) => (
            <div
              key={m.hour}
              className={styles.marker}
              style={{ left: `${(m.hour / totalHours) * 100}%` }}
              title={m.label}
            >
              <div className={styles.markerDot} />
            </div>
          ))}
        </div>
        <div className={styles.tickMarks}>
          {Array.from({ length: totalHours + 1 }, (_, i) => (
            <div
              key={i}
              className={`${styles.tick} ${i % 6 === 0 ? styles.tickMajor : styles.tickMinor}`}
              style={{ left: `${(i / totalHours) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
