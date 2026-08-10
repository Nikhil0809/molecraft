"use client";

import { useState } from "react";
import styles from "./SynthesisRoute.module.css";

interface SynthesisRouteProps {
  routes?: Array<{
    template?: string;
    name?: string;
    reactants?: string[];
    score?: number;
    description?: string;
  }>;
  bestRouteScore?: number;
  saScore?: number;
}

export function SynthesisRoute({ routes, bestRouteScore, saScore }: SynthesisRouteProps) {
  const [open, setOpen] = useState(false);

  if (!routes || routes.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.icon}>🔬</span>
        No synthesis routes available
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button className={styles.header} onClick={() => setOpen(!open)}>
        <span className={styles.icon}>🧪</span>
        <span className={styles.label}>Synthesis Routes</span>
        {saScore !== undefined && (
          <span className={styles.sa}>SA {saScore.toFixed(1)}</span>
        )}
        {bestRouteScore !== undefined && (
          <span className={styles.score}>Score {bestRouteScore.toFixed(2)}</span>
        )}
        <span className={styles.toggle}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className={styles.routes}>
          {routes.map((route, i) => (
            <div key={i} className={styles.route}>
              <div className={styles.routeHeader}>
                <span className={styles.routeName}>{route.name || route.template || `Route ${i + 1}`}</span>
                {route.score !== undefined && (
                  <span className={styles.routeScore}>{route.score.toFixed(2)}</span>
                )}
              </div>
              {route.description && (
                <p className={styles.routeDesc}>{route.description}</p>
              )}
              {route.reactants && route.reactants.length > 0 && (
                <div className={styles.reactants}>
                  {route.reactants.map((r, j) => (
                    <code key={j} className={styles.reactant}>{r}</code>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}