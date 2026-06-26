"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import styles from "./NavSidebar.module.css";

const CORE_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },

  { href: "/chat", label: "AI Chat" },
  { href: "/generate", label: "Generate" },
  { href: "/predict", label: "Predict" },
  { href: "/library", label: "Library" },
  { href: "/projects", label: "Projects" },
  { href: "/analytics", label: "Analytics" },
];

const OMNI_ITEMS = [
  { href: "/omics", label: "Omics Discovery" },
  { href: "/antibody", label: "Antibody Design" },
  { href: "/protac", label: "PROTAC Design" },
  { href: "/rna", label: "RNA Design" },
  { href: "/peptide", label: "Peptide Design" },
  { href: "/clinical", label: "Clinical Trials" },
  { href: "/lab", label: "Lab Automation" },
  { href: "/patent", label: "Patent IP" },
  { href: "/simulation", label: "Simulation" },
];

const WORKSPACE_ITEMS = [
  { href: "/history", label: "History" },
  { href: "/notifications", label: "Notifications" },
  { href: "/team", label: "Team" },
  { href: "/billing", label: "Billing" },
  { href: "/help", label: "Help Center" },
];

export function NavSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [popupPos, setPopupPos] = useState({ bottom: 0, left: 0, width: 0 });
  const popupRef = useRef<HTMLDivElement>(null);
  const userCardRef = useRef<HTMLDivElement>(null);
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname === "/";
  if (isAuthPage) return null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) &&
          userCardRef.current && !userCardRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    if (showProfile) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [showProfile]);

  useEffect(() => {
    if (showProfile && userCardRef.current) {
      const rect = userCardRef.current.getBoundingClientRect();
      setPopupPos({ bottom: window.innerHeight - rect.top, left: rect.left + 8, width: rect.width - 16 });
    }
  }, [showProfile]);

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const isActive = pathname === href || pathname?.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`${styles.navItem} ${isActive ? styles.active : ""}`}
      >
        <span className={styles.navLabel}>{label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.logoArea}>
          <div className={styles.logoInner}>
            <img src="/logo.png" alt="MoleCraft" className={styles.logo} />
            <span className={styles.logoText}>MoleCraft</span>
            
          </div>
          <button className={styles.sidebarToggle} onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand" : "Collapse"}>
            <i className={`fa-solid ${collapsed ? "fa-chevron-right" : "fa-chevron-left"}`}></i>
          </button>
        </div>

        <div className={styles.navScroll}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Core</div>
            {CORE_ITEMS.map((item) => <NavLink key={item.href} {...item} />)}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>OmniMole</div>
            {OMNI_ITEMS.map((item) => <NavLink key={item.href} {...item} />)}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Workspace</div>
            {WORKSPACE_ITEMS.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        </div>

        {user && (
          <div className={styles.userCard} onClick={() => setShowProfile(!showProfile)} ref={userCardRef}>
            <div className={styles.userAvatar}>
              {user.display_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || user.email[0].toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.display_name || user.email}</div>
              <div className={styles.userOrg}>{user.organization || "Independent"}</div>
            </div>
            <i className={`fa-solid fa-chevron-up ${styles.userChevron} ${showProfile ? styles.userChevronOpen : ""}`}></i>
          </div>
        )}
      </aside>

      {collapsed && (
        <button className={styles.floatToggle} onClick={() => setCollapsed(false)} title="Expand sidebar">
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      )}

      {showProfile && user && (
        <div className={styles.profilePopup} ref={popupRef} style={{ bottom: popupPos.bottom + 8, left: popupPos.left, width: popupPos.width }}>
          <div className={styles.profileHeader}>
            <div className={styles.profileAvatar}>
              {user.display_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || user.email[0].toUpperCase()}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{user.display_name || user.email}</div>
              <div className={styles.profileEmail}>{user.email}</div>
              {user.organization && <div className={styles.profileOrg}>{user.organization}</div>}
              <div className={styles.profileTier}>{user.tier?.charAt(0).toUpperCase() + user.tier?.slice(1) || "Standard"}</div>
            </div>
          </div>
          <div className={styles.profileDivider} />
          <Link href="/settings" className={styles.profileMenuItem} onClick={() => setShowProfile(false)}>
            <i className="fa-solid fa-gear"></i>
            <span>Settings</span>
          </Link>
          <button className={styles.profileMenuItem} onClick={() => { logout(); setShowProfile(false); }}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </>
  );
}
