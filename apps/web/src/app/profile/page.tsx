"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import styles from "./page.module.css";

interface ActivityItem {
  id: string;
  action: string;
  type: "generate" | "predict" | "export";
  target: string;
  timestamp: string;
}

const MOCK_ACTIVITIES: ActivityItem[] = [
  { id: "act-001", action: "Exported cohort COX-2 SDF", type: "export", target: "6 molecules", timestamp: "2026-06-20T14:35:00Z" },
  { id: "act-002", action: "Generated cohort", type: "generate", target: "COX-2 selective pocket", timestamp: "2026-06-20T14:32:00Z" },
  { id: "act-003", action: "Predicted binding affinity", type: "predict", target: "Acetylsalicylic acid (Aspirin)", timestamp: "2026-06-20T13:15:00Z" },
  { id: "act-004", action: "Generated cohort", type: "generate", target: "EGFR binding domain", timestamp: "2026-06-19T09:45:00Z" },
  { id: "act-005", action: "Exported high-res structure SVG", type: "export", target: "Pyrene structure", timestamp: "2026-06-18T16:30:00Z" },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/history");
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.history || []).slice(0, 5).map((h: { id: string; mode: string; query: string; moleculeCount: number; targetProtein?: string; timestamp: string }) => ({
            id: h.id,
            action: h.mode === "generate" ? `Generated cohort: "${h.query}"` : `Predicted binding affinity`,
            type: h.mode as "generate" | "predict" | "export",
            target: h.mode === "predict" ? (h.targetProtein || "Unknown Target") : `${h.moleculeCount} molecule${h.moleculeCount !== 1 ? "s" : ""}`,
            timestamp: h.timestamp
          }));
          setActivities(mapped.length > 0 ? mapped : MOCK_ACTIVITIES);
        } else {
          setActivities(MOCK_ACTIVITIES);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
        setActivities(MOCK_ACTIVITIES);
      }
    };
    fetchHistory();
  }, []);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const displayName = user?.display_name || "Dr. Elena Vance";
  const role = user?.role || "Senior Computational Chemist";
  const organization = user?.organization || "BioTech Alpha Synthesis Labs";
  const email = user?.email || "elena.vance@biotechalpha.com";
  const tier = user?.tier || "enterprise";

  // Compute resource calculations
  const remainingCredits = user?.compute_credits ?? 3580;
  const totalAllocation = remainingCredits > 1000 ? 5000 : 1000;
  const expendedCredits = totalAllocation - remainingCredits;
  const percentageExpended = ((expendedCredits / totalAllocation) * 100).toFixed(1);
  const strokeDash = Math.round(parseFloat(percentageExpended));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Researcher Profile</h1>
        <span className={styles.badge}>{tier.charAt(0).toUpperCase() + tier.slice(1)} Tier</span>
      </header>

      <div className={styles.grid}>
        {/* User Card */}
        <section className={styles.card} aria-label="Researcher details">
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </svg>
            </div>
            <div className={styles.profileMeta}>
              <h2 className={styles.userName}>{displayName}</h2>
              <span className={styles.userRole}>{role}</span>
              <span className={styles.userOrg}>{organization}</span>
            </div>
          </div>
          <div className={styles.divider} />
          <div className={styles.profileDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Email</span>
              <span className={styles.detailValue}>{email}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Active Workspaces</span>
              <span className={styles.detailValue}>COX-2 Synthesis, EGFR inhibitors</span>
            </div>
          </div>
        </section>

        {/* Compute Resource Usage */}
        <section className={styles.card} aria-label="Compute usage">
          <h3 className={styles.cardTitle}>Compute Resource Allocation</h3>
          <div className={styles.gaugeContainer}>
            <div className={styles.radialGauge}>
              <svg viewBox="0 0 36 36" className={styles.circularChart}>
                <path
                  className={styles.circleBg}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={styles.circle}
                  strokeDasharray={`${strokeDash}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className={styles.percentage}>{percentageExpended}%</text>
              </svg>
            </div>
            <div className={styles.gaugeInfo}>
              <div className={styles.gaugeStat}>
                <span className={styles.gaugeVal}>{expendedCredits.toLocaleString()} credits</span>
                <span className={styles.gaugeLabel}>Credits Expended</span>
              </div>
              <div className={styles.gaugeStat}>
                <span className={styles.gaugeVal}>{remainingCredits.toLocaleString()} credits</span>
                <span className={styles.gaugeLabel}>Allocation Remaining</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Calculations Stats */}
      <section className={styles.statsCard} aria-label="Usage stats">
        <h3 className={styles.cardTitle}>Calculation Statistics</h3>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Cohorts Generated</span>
            <span className={styles.statValue}>84</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Single Predictions Run</span>
            <span className={styles.statValue}>312</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Avg Cohort Generate Time</span>
            <span className={styles.statValue}>3.4s</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>RAG Query Success Rate</span>
            <span className={styles.statValue}>99.6%</span>
          </div>
        </div>
      </section>

      {/* Activity Log */}
      <section className={styles.tableCard} aria-label="Recent activity log">
        <h3 className={styles.cardTitle}>Recent Activity Log</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Target Scope</th>
              <th>Timestamp</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((act) => (
              <tr key={act.id}>
                <td className={styles.actionCell}>
                  <span className={`${styles.actionIcon} ${styles[act.type]}`}>
                    {act.type === "generate" && "⚡"}
                    {act.type === "predict" && "🔮"}
                    {act.type === "export" && "📥"}
                  </span>
                  {act.action}
                </td>
                <td className={styles.monoCell}>{act.target}</td>
                <td>{formatDate(act.timestamp)}</td>
                <td>
                  <span className={styles.statusSuccess}>Success</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
