"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { RotatingLogo } from "@/components/loading/RotatingLogo";

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const molecules: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; phase: number; speed: number; opacity: number;
      color: string;
    }> = [];

    for (let i = 0; i < 45; i++) {
      molecules.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: 15 + Math.random() * 55,
        phase: Math.random() * Math.PI * 2,
        speed: 0.001 + Math.random() * 0.003,
        opacity: 0.06 + Math.random() * 0.12,
        color: Math.random() > 0.5 ? "#6366f1" : "#06b6d4",
      });
    }

    let animId: number;
    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.7
      );
      grad.addColorStop(0, "#080918");
      grad.addColorStop(0.5, "#04050d");
      grad.addColorStop(1, "#010204");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const m of molecules) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x < -100) m.x = canvas.width + 100;
        if (m.x > canvas.width + 100) m.x = -100;
        if (m.y < -100) m.y = canvas.height + 100;
        if (m.y > canvas.height + 100) m.y = -100;

        const hexSize = m.size;
        const pulse = 1 + Math.sin(time * m.speed + m.phase) * 0.12;

        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(time * m.speed * 0.2 + m.phase);
        ctx.scale(pulse, pulse);
        ctx.globalAlpha = m.opacity;
        ctx.strokeStyle = m.color;
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = Math.cos(angle) * hexSize;
          const py = Math.sin(angle) * hexSize;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = Math.cos(angle) * hexSize * 0.6;
          const py = Math.sin(angle) * hexSize * 0.6;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-display)",
      backgroundColor: "#05070e",
    }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />

      {/* Decorative ambient glowing backdrops */}
      <div style={{
        position: "absolute", width: "400px", height: "400px",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
        filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
        top: "10%", left: "15%",
      }} />
      <div style={{
        position: "absolute", width: "400px", height: "400px",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)",
        filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
        bottom: "10%", right: "15%",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", gap: "40px",
        padding: "40px", borderRadius: "24px",
        background: "rgba(10, 14, 28, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
      }}>
        <RotatingLogo size={104} baseDuration={24} clockwise />

        <div style={{ textAlign: "center" }}>
          <h1 style={{
            fontSize: "clamp(2.5rem, 6vw, 4.2rem)", fontWeight: 800,
            letterSpacing: "-0.04em", margin: 0,
            background: "linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))",
          }}>
            MoleCraft
          </h1>
          <p style={{
            fontSize: "clamp(0.9rem, 1.8vw, 1.15rem)",
            color: "var(--text-secondary)", marginTop: "12px", letterSpacing: "0.03em",
            fontWeight: 500,
          }}>
            AI-Powered Drug Discovery Platform
          </p>
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: "8px" }}>
          <Link href="/login" style={{
            padding: "14px 38px", borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #06b6d4)",
            color: "#fff", fontWeight: 600, fontSize: "0.95rem",
            textDecoration: "none", transition: "transform 0.2s, box-shadow 0.2s, opacity 0.2s",
            boxShadow: "0 4px 24px rgba(99, 102, 241, 0.4)",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(99, 102, 241, 0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(99, 102, 241, 0.4)"; }}>
            Sign In
          </Link>
          <Link href="/signup" style={{
            padding: "14px 38px", borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.03)", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.95rem",
            textDecoration: "none", border: "1px solid rgba(255, 255, 255, 0.08)",
            transition: "all 0.2s ease-in-out",
            boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "rgba(99, 102, 241, 0.05)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)"; e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            Request Access
          </Link>
        </div>

        <div style={{
          display: "flex", gap: "32px", marginTop: "16px",
          color: "var(--text-muted)", fontSize: "0.75rem",
          fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          <span style={{ transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>Molecular Gen</span>
          <span style={{ transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>Binding Prediction</span>
          <span style={{ transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>Retrosynthesis</span>
          <span style={{ transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>ADMET Suite</span>
        </div>
      </div>
    </div>
  );
}
