"use client";

import { useState } from "react";
import styles from "./Tabs.module.css";

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`${styles.tabs} ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${active === tab.id ? styles.active : ""}`}
          onClick={() => onChange(tab.id)}
          role="tab"
          aria-selected={active === tab.id}
        >
          {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span className={styles.count}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
