"use client";

import { useEffect, useState } from "react";
import styles from "./AgentIndicator.module.css";

interface Agent {
  id: string;
  name: string;
  color: string;
  status: "idle" | "searching" | "done" | "error";
  activity: string;
}

interface AgentIndicatorProps {
  agents: Agent[];
  nodeX: number;
  nodeY: number;
}

const STATUS_CLASS: Record<string, string> = {
  idle: styles.idle,
  searching: styles.searching,
  done: styles.done,
  error: styles.error,
};

export function AgentIndicator({ agents, nodeX, nodeY }: AgentIndicatorProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % 360), 50);
    return () => clearInterval(t);
  }, []);

  if (agents.length === 0) return null;

  const radius = 52;

  return (
    <div
      className={styles.constellation}
      style={{ left: nodeX + 100, top: nodeY - 20, position: "absolute" }}
    >
      {agents.map((agent, i) => {
        const angle = ((2 * Math.PI) / agents.length) * i + (phase * Math.PI) / 180;
        const x = Math.cos(angle) * radius - 12;
        const y = Math.sin(angle) * radius - 12;

        return (
          <div
            key={agent.id}
            className={`${styles.agent} ${STATUS_CLASS[agent.status] || ""}`}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              "--agent-color": agent.color,
            } as React.CSSProperties}
            title={`${agent.name}: ${agent.activity}`}
          >
            <div className={styles.dot} />
            <span className={styles.label}>{agent.name}</span>
          </div>
        );
      })}
    </div>
  );
}
