"use client";

import { usePathname } from "next/navigation";
import { NavSidebar } from "./NavSidebar";
import styles from "@/app/layout.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <div className={styles.appShell}>
      <NavSidebar />
      <div className={styles.rightPanel}>
        <main className={styles.mainPanel}>
          <div className={styles.ambientGlow1} />
          <div className={styles.ambientGlow2} />
          {children}
        </main>
      </div>
    </div>
  );
}
