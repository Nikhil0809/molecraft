"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import Link from "next/link";
import styles from "./page.module.css";

const QUICK_ACTIONS = [
  { label: "New Molecule", href: "/generate", icon: "generate", desc: "AI-powered generation" },
  { label: "Open Workspace", href: "/workspace", icon: "workspace", desc: "Spatial design canvas" },
  { label: "Run Simulation", href: "/simulation", icon: "sim", desc: "Physics engine" },
  { label: "View Library", href: "/library", icon: "library", desc: "Molecule repository" },
];



const STAT_META = [
  { label: "Molecules Generated", key: "molecules_generated" as const, unit: "" },
  { label: "Predictions Run", key: "predictions_run" as const, unit: "" },
  { label: "Active Projects", key: "active_projects" as const, unit: "" },
  { label: "Simulations Run", key: "simulations_run" as const, unit: "" },
];

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "generation":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5">
          <path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.636 5.636l.707.707M17.657 17.657l.707.707M5.636 18.364l.707-.707M17.657 6.343l.707-.707" />
          <circle cx="12" cy="12" r="4" fill="#7C3AED" fillOpacity="0.1" />
        </svg>
      );
    case "prediction":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.5">
          <circle cx="12" cy="12" r="8" />
          <polyline points="12 8 12 12 16 14" />
        </svg>
      );
    case "simulation":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case "patent":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
    default:
      return null;
  }
}

function StatSkeleton() {
  return (
    <div className={styles.statCard}>
      <div className={styles.skelStatLabel} />
      <div className={styles.skelStatValue} />
      <div className={styles.skelStatChange} />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ molecules_generated: "—", predictions_run: "—", active_projects: "—", simulations_run: "—" });
  const [activity, setActivity] = useState<{ type: string; target: string; time: string; status: string }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          setStats({
            molecules_generated: (data.stats.molecules_generated || 0).toLocaleString(),
            predictions_run: (data.stats.predictions_run || 0).toLocaleString(),
            active_projects: String(data.stats.active_projects || 0),
            simulations_run: String(data.stats.simulations_run || 0),
          });
          setActivity(data.recent_activity || []);
        }
      } catch (e) {
        console.error("Failed to load dashboard", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);

    const dots = Array.from({ length: 20 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
      r: Math.random() * 1.5 + 0.5, a: Math.random() * 0.15 + 0.03,
    }));

    let animId: number;
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      dots.forEach((d) => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124, 58, 237, ${d.a})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animId); };
  }, []);

  const timeOfDay = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";

  return (
    <div className={styles.page}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      <div className={styles.inner}>
        {/* Welcome */}
        <div className={styles.welcome}>
          <div className={styles.welcomeContent}>
            <h1 className={styles.welcomeTitle}>
              Good {timeOfDay}, {user?.display_name?.split(" ")[0] || "Researcher"}
            </h1>
            <p className={styles.welcomeDesc}>Your molecular design workspace is ready. 14 active projects across 3 pipelines.</p>
          </div>
          <div className={styles.welcomeBadge}>
            <Badge variant="brand">v5.0 Enterprise</Badge>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
            {loading
            ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            : STAT_META.map((meta) => (
                <Card key={meta.label} padding="lg" hover>
                  <div className={styles.statCard}>
                    <p className={styles.statLabel}>{meta.label}</p>
                    <div className={styles.statRow}>
                      <span className={styles.statValue}>{stats[meta.key]}</span>
                      {meta.unit && <span className={styles.statUnit}>{meta.unit}</span>}
                    </div>
                  </div>
                </Card>
            ))}
        </div>

        <div className={styles.grid2col}>
          {/* Quick Actions */}
          <Card padding="lg">
            <h2 className={styles.sectionTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              Quick Actions
            </h2>
            <div className={styles.actionGrid}>
              {QUICK_ACTIONS.map((action) => (
                <Link href={action.href} key={action.label} className={styles.actionCard}>
                  <span className={styles.actionIcon}>
                    {action.icon === "generate" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.636 5.636l.707.707M17.657 17.657l.707.707M5.636 18.364l.707-.707M17.657 6.343l.707-.707" /><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.1" /></svg>}
                    {action.icon === "workspace" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>}
                    {action.icon === "sim" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
                    {action.icon === "library" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>}
                  </span>
                  <div>
                    <p className={styles.actionLabel}>{action.label}</p>
                    <p className={styles.actionDesc}>{action.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card padding="lg">
            <h2 className={styles.sectionTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Recent Activity
            </h2>
            <div className={styles.activityList}>
              {activity.length === 0 && !loading && <p className={styles.activityEmpty}>No recent activity yet</p>}
              {activity.map((item, i) => (
                <div key={i} className={styles.activityItem}>
                  <ActivityIcon type={item.type} />
                  <div className={styles.activityInfo}>
                    <p className={styles.activityTarget}>{item.target}</p>
                    <div className={styles.activityMeta}>
                      <span className={styles.activityTime}>{item.time ? new Date(item.time).toLocaleDateString() : "recent"}</span>
                      <Badge variant={item.status === "running" ? "amber" : "green"}>{item.status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.activityFooter}>
              <Button variant="ghost" size="sm" onClick={() => toast({ title: "Loading full history...", type: "info" })}>
                View all activity
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
