"use client";

import { usePathname } from "next/navigation";
import { NavSidebar } from "./NavSidebar";
import styles from "@/app/layout.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <div className={styles.appShell}>
      <NavSidebar />
      <main className={styles.mainPanel}>{children}</main>
    </div>
  );
}
