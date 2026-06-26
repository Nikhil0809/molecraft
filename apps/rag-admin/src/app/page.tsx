"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";


interface LogEntry {
  id: string;
  time: string;
  level: "info" | "warn" | "danger";
  message: string;
}

export default function RagAdminPage() {
  const [timeRange, setTimeRange] = useState("Last 24h");
  
  // Pipeline Settings Tuning
  const [cacheExpiry, setCacheExpiry] = useState(60); // minutes
  const [latencyThreshold, setLatencyThreshold] = useState(1.5); // seconds
  const [maxConcurrency, setMaxConcurrency] = useState(10); // tasks
  
  // Live log terminal states
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [logFilter, setLogFilter] = useState<"all" | "info" | "warn" | "danger">("all");
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // SVG Chart Hover Tooltip State
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Dashboard Metrics State
  const [metrics, setMetrics] = useState({
    t1HitRate: 84,
    cacheHitRate: 67,
    avgLatency: 1.2,
    apiErrors: 3,
    sourceVolumes: [
      { name: "ChEMBL", calls: 1247, color: "var(--accent-primary)" },
      { name: "PubMed", calls: 982, color: "var(--accent-success)" },
      { name: "PubChem", calls: 756, color: "var(--accent-warning)" },
      { name: "UniProt", calls: 421, color: "#8B5CF6" },
      { name: "Tavily", calls: 198, color: "var(--text-secondary)" },
    ],
    latencyOverTime: [
      { time: "00:00", value: 1.4 },
      { time: "04:00", value: 1.1 },
      { time: "08:00", value: 1.8 },
      { time: "12:00", value: 2.3 },
      { time: "16:00", value: 1.5 },
      { time: "20:00", value: 1.2 },
      { time: "Now", value: 1.2 },
    ]
  });

  const mapDbLevelToUi = (level: string) => {
    if (level === "error") return "danger";
    if (level === "warning") return "warn";
    return "info";
  };

  useEffect(() => {
    const doFetchMetrics = async () => {
      try {
        const res = await fetch("/api/admin/metrics");
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error("Failed to load admin metrics:", err);
      }
    };

    const doFetchLogs = async () => {
      try {
        const res = await fetch("/api/admin/logs");
        if (res.ok) {
          const data = await res.json();
          const formattedLogs = (data.logs as Array<{ id: string; timestamp: string; level: string; message: string }>).map((l) => ({
            id: l.id,
            time: l.timestamp.split("T")[1].split(".")[0],
            level: mapDbLevelToUi(l.level) as "info" | "warn" | "danger",
            message: l.message
          }));
          setLogs(formattedLogs.reverse());
        }
      } catch (err) {
        console.error("Failed to load admin logs:", err);
      }
    };

    doFetchMetrics();
    doFetchLogs();

    const interval = setInterval(() => {
      doFetchMetrics();
      if (isPlaying) {
        doFetchLogs();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Auto-scroll logs terminal
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Calculate dynamic warning count
  const warnings = [
    { source: "PubMed", usage: "847/1000", percent: 85, status: "warning" as const, message: "Approaching daily rate limit" },
    { source: "Tavily", usage: "178/200", percent: 89, status: "danger" as const, message: "Near rate limit — throttling active" },
    { source: "ChEMBL", usage: "412/2000", percent: 21, status: "ok" as const, message: "Within normal range" },
    { source: "UniProt", usage: "198/500", percent: 40, status: "ok" as const, message: "Within normal range" },
  ];

  const activeWarningCount = warnings.filter((w) => w.status !== "ok" || parseFloat(w.usage.split("/")[0]) > 800).length;

  const maxCalls = Math.max(...metrics.sourceVolumes.map((s) => s.calls));
  const maxLatency = Math.max(...metrics.latencyOverTime.map((d) => d.value));

  // SVG line chart points
  const chartWidth = 500;
  const chartHeight = 120;
  const points = metrics.latencyOverTime.map((d, i) => {
    const x = (i / (metrics.latencyOverTime.length - 1)) * chartWidth;
    const y = chartHeight - (d.value / (maxLatency * 1.2)) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

  const filteredLogs = logs.filter((l) => logFilter === "all" || l.level === logFilter);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path d="M14 3L17.5 9.5L24 14L17.5 18.5L14 25L10.5 18.5L4 14L10.5 9.5L14 3Z" fill="var(--accent-primary)" fillOpacity="0.2" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="14" cy="14" r="3" fill="var(--accent-primary)"/>
          </svg>
          <h1 className={styles.headerTitle}>MoleCraft RAG Admin</h1>
        </div>
        <div className={styles.headerRight}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className={styles.timeSelect}
          >
            {["Last 1h", "Last 6h", "Last 24h", "Last 7d"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className={styles.alertBadge} title={`${activeWarningCount} active warnings`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L15 13H1L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M8 6V9M8 11V11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>{activeWarningCount}</span>
          </div>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard} style={{ animationDelay: "0ms" }}>
          <span className={styles.metricLabel}>T1 Hit Rate</span>
          <span className={styles.metricValue}>{metrics.t1HitRate}%</span>
          <span className={`${styles.metricTrend} ${styles.trendPositive}`}>↑ +2.1%</span>
        </div>
        <div className={styles.metricCard} style={{ animationDelay: "80ms" }}>
          <span className={styles.metricLabel}>Cache Hit %</span>
          <span className={styles.metricValue}>{metrics.cacheHitRate}%</span>
          <span className={`${styles.metricTrend} ${styles.trendPositive}`}>↑ +5.3%</span>
        </div>
        <div className={styles.metricCard} style={{ animationDelay: "160ms" }}>
          <span className={styles.metricLabel}>Avg Latency</span>
          <span className={styles.metricValue}>{metrics.avgLatency}s</span>
          <span className={`${styles.metricTrend} ${styles.trendPositive}`}>↓ -0.3s (Target: &lt;{latencyThreshold}s)</span>
        </div>
        <div className={styles.metricCard} style={{ animationDelay: "240ms" }}>
          <span className={styles.metricLabel}>API Errors (24h)</span>
          <span className={styles.metricValue}>{metrics.apiErrors}</span>
          <span className={`${styles.metricTrend} ${styles.trendNegative}`}>↑ +1 error</span>
        </div>
      </div>

      {/* Charts and Settings Split Row */}
      <div className={styles.chartsRow}>
        {/* Source Volume Bar Chart */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>API Call Volume by Source</h3>
          <div className={styles.barChart}>
            {metrics.sourceVolumes.map((s) => (
              <div key={s.name} className={styles.barRow}>
                <span className={styles.barLabel}>{s.name}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${(s.calls / maxCalls) * 100}%`,
                      background: s.color,
                    }}
                  />
                </div>
                <span className={styles.barValue}>{s.calls.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Latency Line Chart with Interactive hover points */}
        <div className={`${styles.chartCard} ${styles.lineCard}`}>
          <h3 className={styles.chartTitle}>Retrieval Latency Over Time</h3>
          <div className={styles.lineChart}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className={styles.lineSvg} preserveAspectRatio="none">
              <defs>
                <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1={chartHeight * 0.25} x2={chartWidth} y2={chartHeight * 0.25} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="0" y1={chartHeight * 0.75} x2={chartWidth} y2={chartHeight * 0.75} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3 3" />
              
              <polygon points={areaPoints} fill="url(#latencyGrad)"/>
              <polyline points={points} fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
              {metrics.latencyOverTime.map((d, i) => {
                const x = (i / (metrics.latencyOverTime.length - 1)) * chartWidth;
                const y = chartHeight - (d.value / (maxLatency * 1.2)) * chartHeight;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={hoveredPoint === i ? "6" : "4"}
                    fill={hoveredPoint === i ? "var(--accent-primary-hover)" : "var(--accent-primary)"}
                    stroke="var(--bg-surface)"
                    strokeWidth="2"
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                  />
                );
              })}
            </svg>
            <div className={styles.lineLabels}>
              {metrics.latencyOverTime.map((d) => (
                <span key={d.time} className={styles.lineLabel}>{d.time}</span>
              ))}
            </div>

            {/* Float Tooltip */}
            {hoveredPoint !== null && (
              <div
                className={styles.chartTooltip}
                style={{
                  left: `${(hoveredPoint / (metrics.latencyOverTime.length - 1)) * 80 + 10}%`,
                  bottom: "45px",
                }}
              >
                <span className={styles.tooltipTime}>{metrics.latencyOverTime[hoveredPoint].time}</span>
                <span className={styles.tooltipVal}>{metrics.latencyOverTime[hoveredPoint].value}s</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operator controls config and Warnings Table split */}
      <div className={styles.dashboardSplit}>
        {/* Sliders Control Panel */}
        <section className={styles.controlPanelCard} aria-label="Pipeline alert parameters">
          <h3 className={styles.chartTitle}>Threshold Settings</h3>
          <div className={styles.controlsGrid}>
            <div className={styles.controlRow}>
              <label htmlFor="cache-expiry" className={styles.controlLabel}>
                Cache Expiry: <span>{cacheExpiry} min</span>
              </label>
              <input
                id="cache-expiry"
                type="range"
                min="10"
                max="360"
                step="10"
                value={cacheExpiry}
                onChange={(e) => setCacheExpiry(parseInt(e.target.value))}
                className={styles.slider}
              />
            </div>
            <div className={styles.controlRow}>
              <label htmlFor="latency-limit" className={styles.controlLabel}>
                Max Latency Alert: <span>{latencyThreshold}s</span>
              </label>
              <input
                id="latency-limit"
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={latencyThreshold}
                onChange={(e) => setLatencyThreshold(parseFloat(e.target.value))}
                className={styles.slider}
              />
            </div>
            <div className={styles.controlRow}>
              <label htmlFor="max-concurrency" className={styles.controlLabel}>
                Max Fetch Concurrency: <span>{maxConcurrency} tasks</span>
              </label>
              <input
                id="max-concurrency"
                type="range"
                min="2"
                max="30"
                step="1"
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(parseInt(e.target.value))}
                className={styles.slider}
              />
            </div>
          </div>
        </section>

        {/* Rate Limit Status */}
        <div className={styles.tableCard}>
          <h3 className={styles.chartTitle}>Rate Limit Status</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Usage</th>
                <th>Utilization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((w) => (
                <tr key={w.source} className={styles[w.status]}>
                  <td className={styles.sourceCell}>{w.source}</td>
                  <td className={styles.monoCell}>{w.usage}</td>
                  <td>
                    <div className={styles.utilizationBar}>
                      <div
                        className={styles.utilizationFill}
                        style={{
                          width: `${w.percent}%`,
                          background:
                            w.status === "danger"
                              ? "var(--accent-danger)"
                              : w.status === "warning"
                              ? "var(--accent-warning)"
                              : "var(--accent-success)",
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[`status_${w.status}`]}`}>
                      {w.status === "ok" ? "OK" : w.status === "warning" ? "Warning" : "Critical"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Logs Terminal Console */}
      <section className={styles.terminalCard} aria-label="RAG Live Logging Console">
        <div className={styles.terminalHeader}>
          <div className={styles.terminalMeta}>
            <div className={styles.greenPulse} />
            <h3 className={styles.terminalTitle}>Pipeline Logging Stream</h3>
          </div>
          
          <div className={styles.terminalControls}>
            <div className={styles.filters}>
              {(["all", "info", "warn", "danger"] as const).map((lvl) => (
                <button
                  key={lvl}
                  className={`${styles.filterBtn} ${logFilter === lvl ? styles.filterBtnActive : ""}`}
                  onClick={() => setLogFilter(lvl)}
                >
                  {lvl.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              className={styles.playPauseBtn}
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? "Pause log stream" : "Play log stream"}
            >
              {isPlaying ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="4" height="16" />
                    <rect x="16" y="4" width="4" height="16" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Resume
                </>
              )}
            </button>
          </div>
        </div>

        <div className={styles.terminalBody}>
          <div className={styles.logList}>
            {filteredLogs.map((log) => (
              <div key={log.id} className={`${styles.logRow} ${styles[`log_${log.level}`]}`}>
                <span className={styles.logTime}>[{log.time}]</span>
                <span className={styles.logLevel}>[{log.level.toUpperCase()}]</span>
                <span className={styles.logMsg}>{log.message}</span>
              </div>
            ))}
            <div ref={consoleBottomRef} />
          </div>
        </div>
      </section>
    </div>
  );
}
