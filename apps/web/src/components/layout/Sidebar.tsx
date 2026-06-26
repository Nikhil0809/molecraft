"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import styles from "./Sidebar.module.css";

const NAV_ITEMS_TOP = [
  {
    href: "/generate",
    label: "Generate",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L12.5 7.5L18 10L12.5 12.5L10 18L7.5 12.5L2 10L7.5 7.5L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/predict",
    label: "Predict",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="10" cy="10" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 7H13M7 10H13M7 13H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const NAV_ITEMS_BOTTOM = [
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 2V4M10 16V18M18 10H16M4 10H2M15.66 4.34L14.24 5.76M5.76 14.24L4.34 15.66M15.66 15.66L14.24 14.24M5.76 5.76L4.34 4.34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 17C4 14.2386 6.68629 12 10 12C13.3137 12 16 14.2386 16 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  if (isAuthPage) return null;

  return (
    <nav
      className={`${styles.sidebar} ${expanded ? styles.expanded : styles.collapsed}`}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className={styles.logoArea}>
        <button
          className={styles.logoButton}
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <div className={styles.logoMark}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 3L17.5 9.5L24 14L17.5 18.5L14 25L10.5 18.5L4 14L10.5 9.5L14 3Z"
                fill="var(--accent-primary)"
                fillOpacity="0.2"
                stroke="var(--accent-primary)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="14" cy="14" r="3" fill="var(--accent-primary)" />
            </svg>
          </div>
          {expanded && <span className={styles.logoText}>MoleCraft</span>}
        </button>
      </div>

      <div className={styles.divider} />

      {/* Top nav */}
      <div className={styles.navGroup}>
        {NAV_ITEMS_TOP.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              aria-current={isActive ? "page" : undefined}
              title={!expanded ? item.label : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {expanded && <span className={styles.navLabel}>{item.label}</span>}
              {isActive && <span className={styles.activeIndicator} />}
            </Link>
          );
        })}
      </div>

      <div className={styles.spacer} />
      <div className={styles.divider} />

      {/* Bottom nav */}
      <div className={styles.navGroup}>
        {NAV_ITEMS_BOTTOM.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              aria-current={isActive ? "page" : undefined}
              title={!expanded ? item.label : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {expanded && <span className={styles.navLabel}>{item.label}</span>}
            </Link>
          );
        })}

        {/* Logout button */}
        {user && (
          <button
            onClick={logout}
            className={styles.navItem}
            style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
            title={!expanded ? "Sign Out" : undefined}
          >
            <span className={styles.navIcon}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M13 5H17C17.5523 5 18 5.44772 18 6V14C18 14.5523 17.5523 15 17 15H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 14L14 10L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 10H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            {expanded && <span className={styles.navLabel}>Sign Out</span>}
          </button>
        )}
      </div>

      {/* Keyboard hint */}
      {expanded && (
        <div className={styles.keyboardHint}>
          Press <kbd>?</kbd> for shortcuts
        </div>
      )}
    </nav>
  );
}

