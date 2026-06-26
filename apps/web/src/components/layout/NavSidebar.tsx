"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Logo } from "@/components/logo/Logo";
import styles from "./NavSidebar.module.css";

const CORE_ITEMS = [
  { href: "/workspace", label: "Workspace", icon: "◆" },
  { href: "/viewer", label: "3D Viewer", icon: "◈" },
  { href: "/generate", label: "Generate", icon: "✦" },
  { href: "/predict", label: "Predict", icon: "◎" },
  { href: "/history", label: "History", icon: "☰" },
];

const OMNI_ITEMS = [
  { href: "/omics", label: "Omics Discovery", icon: "⊛", tag: "NEW" },
  { href: "/antibody", label: "Antibody Design", icon: "⧫", tag: "NEW" },
  { href: "/protac", label: "PROTAC Design", icon: "⨁", tag: "NEW" },
  { href: "/rna", label: "RNA Design", icon: "⧂", tag: "NEW" },
  { href: "/peptide", label: "Peptide Design", icon: "⊚", tag: "NEW" },
  { href: "/clinical", label: "Clinical Trials", icon: "⊟", tag: "NEW" },
  { href: "/lab", label: "Lab Automation", icon: "⚙", tag: "NEW" },
  { href: "/patent", label: "Patent IP", icon: "⚖", tag: "NEW" },
  { href: "/simulation", label: "Simulation", icon: "⊡", tag: "NEW" },
];

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: "⚙" },
  { href: "/profile", label: "Profile", icon: "◉" },
];

function getSidebarIcon(href: string) {
  const strokeWidth = 1.8;
  switch (href) {
    case "/workspace":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
          <path d="M10 6.5h4M10 17.5h4M6.5 10v4M17.5 10v4" strokeDasharray="2 2" opacity="0.5" />
        </svg>
      );
    case "/viewer":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "/generate":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.636 5.636l.707.707M17.657 17.657l.707.707M5.636 18.364l.707-.707M17.657 6.343l.707-.707" />
          <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
    case "/predict":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <path d="M9 6h6M9 18h6M9 9l6 6M15 9L9 15" opacity="0.6" />
        </svg>
      );
    case "/history":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <polyline points="3 3 3 8 8 8" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "/omics":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 10.5C4.5 5 19.5 5 19.5 10.5S4.5 16 4.5 21.5" />
          <path d="M19.5 10.5C19.5 5 4.5 5 4.5 10.5S19.5 16 19.5 21.5" opacity="0.4" />
          <line x1="6.5" y1="7.5" x2="17.5" y2="7.5" strokeDasharray="1.5 1.5" />
          <line x1="5.5" y1="13.5" x2="18.5" y2="13.5" strokeDasharray="1.5 1.5" />
          <line x1="6.5" y1="19.5" x2="17.5" y2="19.5" strokeDasharray="1.5 1.5" />
        </svg>
      );
    case "/antibody":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M12 12L4 4M12 12l8-8M7 8h10" />
        </svg>
      );
    case "/protac":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="12" r="5" />
          <circle cx="16" cy="12" r="5" fill="currentColor" fillOpacity="0.1" />
          <path d="M12 12h2" />
        </svg>
      );
    case "/rna":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12c4-8 8-8 12 0s8 8 10 0" />
          <line x1="6" y1="8" x2="6" y2="12" />
          <line x1="10" y1="8" x2="10" y2="12" />
          <line x1="14" y1="12" x2="14" y2="16" />
          <line x1="18" y1="12" x2="18" y2="16" />
        </svg>
      );
    case "/peptide":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="8" r="3" />
          <circle cx="12" cy="16" r="3" />
          <circle cx="18" cy="8" r="3" />
          <line x1="8.5" y1="10.5" x2="9.5" y2="13.5" />
          <line x1="14.5" y1="13.5" x2="15.5" y2="10.5" />
        </svg>
      );
    case "/clinical":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M12 11v6M9 14h6" />
        </svg>
      );
    case "/lab":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12M12 3v7M8.5 10H15.5L20 19A2 2 0 0 1 18.2 22H5.8A2 2 0 0 1 4 19L8.5 10Z" />
          <line x1="6" y1="17" x2="18" y2="17" strokeDasharray="2 2" />
        </svg>
      );
    case "/patent":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
    case "/simulation":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case "/settings":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "/profile":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
    default:
      return <span>◆</span>;
  }
}

export function NavSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) setShowShortcuts((s) => !s);
      if (e.key === "Escape") setShowShortcuts(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  if (isAuthPage) return null;

  const NavItem = ({ item, isBottom = false }: { item: typeof CORE_ITEMS[0]; isBottom?: boolean }) => {
    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        className={`${styles.navItem} ${isActive ? styles.active : ""} ${isBottom ? styles.bottomItem : ""}`}
        title={item.label}
      >
        <span className={styles.navIcon}>{getSidebarIcon(item.href)}</span>
        {expanded && <span className={styles.navLabel}>{item.label}</span>}
        {"tag" in item && expanded && <span className={styles.tag}>{(item as any).tag}</span>}
      </Link>
    );
  };

  return (
    <>
      <nav className={`${styles.sidebar} ${expanded ? styles.expanded : styles.collapsed}`} aria-label="Main navigation">
        <div className={styles.sidebarLogo} onClick={() => setExpanded(!expanded)} title={expanded ? "Collapse" : "Expand"}>
          <Logo size={24} animated />
        </div>
        <div className={styles.divider} />

        <div className={styles.section}>
          {expanded && <div className={styles.sectionTitle}>Core</div>}
          {CORE_ITEMS.map((item) => <NavItem key={item.href} item={item} />)}
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          {expanded && <div className={styles.sectionTitle}>OmniMole</div>}
          {OMNI_ITEMS.map((item) => <NavItem key={item.href} item={item as any} />)}
        </div>

        <div className={styles.spacer} />
        <div className={styles.divider} />

        {expanded && user && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.display_name || user.email}</span>
          </div>
        )}

        <div className={styles.bottomGroup}>
          {BOTTOM_ITEMS.map((item) => <NavItem key={item.href} item={item} isBottom />)}

          {user && (
            <button className={styles.navItem} onClick={logout} title="Sign Out">
              <span className={styles.navIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </span>
              {expanded && <span className={styles.navLabel}>Sign Out</span>}
            </button>
          )}

          <button className={styles.navItem} onClick={() => setShowShortcuts(true)} title="Shortcuts (?)">
            <span className={styles.navIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
              </svg>
            </span>
            {expanded && <span className={styles.navLabel}>Shortcuts</span>}
          </button>
        </div>
      </nav>

      {showShortcuts && (
        <div className={styles.overlay} onClick={() => setShowShortcuts(false)}>
          <div className={styles.shortcuts} onClick={(e) => e.stopPropagation()}>
            <div className={styles.shortcutsHeader}>
              <span className={styles.shortcutsTitle}>Keyboard Shortcuts</span>
              <button className={styles.shortcutsClose} onClick={() => setShowShortcuts(false)}>✕</button>
            </div>
            <div className={styles.shortcutsList}>
              <div className={styles.shortcutRow}><kbd className={styles.kbd}>?</kbd><span>Toggle shortcuts</span></div>
              <div className={styles.shortcutRow}><kbd className={styles.kbd}>Esc</kbd><span>Dismiss</span></div>
              <div className={styles.shortcutRow}><kbd className={styles.kbd}>Enter</kbd><span>Submit query</span></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
