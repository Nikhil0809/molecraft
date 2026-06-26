"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import styles from "./page.module.css";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "generation", label: "Generation" },
  { id: "predictions", label: "Predictions" },
  { id: "usage", label: "Usage" },
];

const METRICS_CONFIG = [
  { label: "Total Molecules", key: "total_molecules" as const, icon: "molecule" },
  { label: "Avg Affinity", key: "avg_affinity" as const, icon: "affinity", unit: " kcal/mol" },
  { label: "Total Predictions", key: "total_predictions" as const, icon: "rate" },
];



function MetricIcon({ type }: { type: string }) {
  switch (type) {
    case "molecule":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="#7C3AED" fillOpacity="0.2" /></svg>;
    case "affinity":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.5"><path d="M12 20V10M18 20V4M6 20v-4" /></svg>;
    case "rate":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
    case "users":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    default:
      return null;
  }
}

interface DailyActivity { day: string; count: number }

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ total_molecules: "—", avg_affinity: "—", total_predictions: "—" });
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const data = await res.json();
          setMetrics({
            total_molecules: (data.metrics.total_molecules || 0).toLocaleString(),
            avg_affinity: data.metrics.avg_affinity ? `${data.metrics.avg_affinity}` : "—",
            total_predictions: (data.metrics.total_predictions || 0).toLocaleString(),
          });
          setDailyActivity(data.daily_activity || []);
        }
      } catch (e) {
        console.error("Failed to load analytics", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Analytics</h1>
            <p className={styles.desc}>Platform-wide metrics and AI-powered insights</p>
          </div>
          <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        </div>

        {/* Metric Cards */}
        <div className={styles.metricsGrid}>
            {METRICS_CONFIG.map((m) => (
            <Card key={m.label} padding="lg">
              <div className={styles.metricCard}>
                <div className={styles.metricTop}>
                  <MetricIcon type={m.icon} />
                </div>
                <p className={styles.metricValue}>{metrics[m.key]}{m.unit && <span className={styles.metricUnit}>{m.unit}</span>}</p>
                <p className={styles.metricLabel}>{m.label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card padding="lg">
          <div className={styles.chartHeader}>
            <h2 className={styles.chartTitle}>Weekly Activity</h2>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: "#7C3AED" }} /> Generated
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: "#06B6D4" }} /> Predicted
              </span>
            </div>
          </div>
          <div className={styles.chart}>
            {dailyActivity.length === 0 && <p className={styles.chartEmpty}>No activity data yet</p>}
            {dailyActivity.map((d) => {
              const max = Math.max(...dailyActivity.map((x) => x.count), 1);
              return (
                <div key={d.day} className={styles.barGroup}>
                  <span className={styles.barLabel}>{new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  <div className={styles.bars}>
                    <div className={styles.barRow}>
                      <div className={styles.bar} style={{ height: `${(d.count / max) * 100}%`, background: "#7C3AED" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Insights */}
        <Card padding="lg">
          <h2 className={styles.insightsTitle}>AI Insights</h2>
          <div className={styles.insightsList}>
            <div className={styles.insight}>
              <div className={styles.insightIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <p className={styles.insightText}>Generation efficiency improved 23% this week</p>
                <p className={styles.insightDesc}>Focused library design reduced redundant sampling</p>
              </div>
            </div>
            <div className={styles.insight}>
              <div className={styles.insightIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <p className={styles.insightText}>KRAS project showing highest binding affinity</p>
                <p className={styles.insightDesc}>Average -9.8 kcal/mol across 342 candidates</p>
              </div>
            </div>
            <div className={styles.insight}>
              <div className={styles.insightIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              </div>
              <div>
                <p className={styles.insightText}>Patent filing recommended for 3 lead compounds</p>
                <p className={styles.insightDesc}>Novel scaffolds with strong IP position identified</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
