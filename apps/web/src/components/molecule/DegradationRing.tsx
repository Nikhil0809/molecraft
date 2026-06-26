"use client";

import { useEffect, useRef } from "react";
import styles from "./DegradationRing.module.css";

interface DegradationRingProps {
  smiles: string;
  hours?: number;
  stability?: number;
  size?: number;
}

export function DegradationRing({ hours = 24, stability = 85, size = 48 }: DegradationRingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size * window.devicePixelRatio;
    canvas.height = size * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    /* Background ring */
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 2;
    ctx.stroke();

    /* Degradation curve - draw points over time */
    const points = 48;
    const degradation = 100 - stability;
    const amplitude = (degradation / 100) * radius * 0.6;

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const decay = Math.exp(-(i / points) * (degradation / 30));
      const r = radius - amplitude * (1 - decay);
      const x = cx + r * Math.cos(t - Math.PI / 2);
      const y = cy + r * Math.sin(t - Math.PI / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, `rgba(79, 142, 247, ${0.4 + stability / 200})`);
    gradient.addColorStop(1, `rgba(0, 212, 255, ${0.2 + stability / 300})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    /* Center label */
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.floor(size * 0.28)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${stability}%`, cx, cy);
  }, [stability, size]);

  return <canvas ref={canvasRef} className={styles.ring} style={{ width: size, height: size }} title={`${stability}% stability over ${hours}h`} />;
}
