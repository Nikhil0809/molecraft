"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";

const TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread", count: 3 },
  { id: "archive", label: "Archive" },
];

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  time: string;
}

function NotifIcon({ type }: { type: string }) {
  const props = { width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "1.5" };
  switch (type) {
    case "generation":
      return <svg {...props} viewBox="0 0 24 24"><path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.636 5.636l.707.707M17.657 17.657l.707.707M5.636 18.364l.707-.707M17.657 6.343l.707-.707" /><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.1" /></svg>;
    case "prediction":
      return <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><polyline points="12 8 12 12 16 14" /></svg>;
    case "team":
      return <svg {...props} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "system":
      return <svg {...props} viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>;
    case "billing":
      return <svg {...props} viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
    case "patent":
      return <svg {...props} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.1" /></svg>;
    case "simulation":
      return <svg {...props} viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>;
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifs(data.notifications || []);
        }
      } catch (e) {
        console.error("Failed to load notifications", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (res.ok) {
        setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (e) {
      console.error("Failed to mark all as read", e);
    }
  };

  const filtered = notifs.filter((n) => {
    if (activeTab === "unread") return !n.read;
    return true;
  });

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Notifications</h1>
            <p className={styles.desc}>{unreadCount} unread • {notifs.length} total</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all as read
            </Button>
          )}
        </div>

        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className={styles.tabs} />

        <div className={styles.list}>
          {filtered.map((n) => (
            <Card key={n.id} padding="md" hover className={styles.notifCard}>
              <div className={styles.notifLayout}>
                <div className={`${styles.notifIcon} ${styles[n.type]}`}>
                  <NotifIcon type={n.type} />
                </div>
                <div className={styles.notifContent}>
                  <div className={styles.notifTop}>
                    <h3 className={styles.notifTitle}>{n.title}</h3>
                    <span className={styles.notifTime}>{n.time ? new Date(n.time).toLocaleDateString() : "recent"}</span>
                  </div>
                  <p className={styles.notifMsg}>{n.message}</p>
                </div>
                {!n.read && <span className={styles.unreadDot} />}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
