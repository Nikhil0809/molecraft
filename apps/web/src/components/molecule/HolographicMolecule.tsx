"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./HolographicMolecule.module.css";

interface AtomNode {
  id: number;
  element: string;
  color: string;
  radius: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  charge?: number;
}

interface BondEdge {
  source: number;
  target: number;
  type: string;
}

interface HolographicMoleculeProps {
  smiles: string;
  width?: number;
  height?: number;
  interactive?: boolean;
  showESP?: boolean;
}

const ATOM_STYLES: Record<string, { color: string; radius: number; espColor?: string }> = {
  C: { color: "#9ca3af", radius: 8, espColor: "#4a5568" },
  c: { color: "#6b7280", radius: 8, espColor: "#4a5568" },
  O: { color: "#f87171", radius: 7.5, espColor: "#dc2626" },
  o: { color: "#ef4444", radius: 7.5, espColor: "#dc2626" },
  N: { color: "#60a5fa", radius: 8, espColor: "#2563eb" },
  n: { color: "#3b82f6", radius: 8, espColor: "#2563eb" },
  F: { color: "#34d399", radius: 7, espColor: "#059669" },
  S: { color: "#fbbf24", radius: 9, espColor: "#d97706" },
  s: { color: "#f59e0b", radius: 9, espColor: "#d97706" },
  Cl: { color: "#10b981", radius: 9, espColor: "#059669" },
  Br: { color: "#b45309", radius: 10, espColor: "#92400e" },
  I: { color: "#a78bfa", radius: 11, espColor: "#7c3aed" },
  H: { color: "#ffffff", radius: 5, espColor: "#e5e7eb" },
};

const ELECTRONEGATIVITY: Record<string, number> = {
  C: 2.55, c: 2.55, O: 3.44, o: 3.44, N: 3.04, n: 3.04,
  F: 3.98, S: 2.58, s: 2.58, Cl: 3.16, Br: 2.96, I: 2.66, H: 2.20,
};

export default function HolographicMolecule({
  smiles,
  width = 280,
  height = 280,
  interactive = true,
  showESP = true,
}: HolographicMoleculeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [hoveredBond, setHoveredBond] = useState<{ source: number; target: number } | null>(null);

  const rotationRef = useRef({ x: 0.4, y: 0.6 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const nodesRef = useRef<AtomNode[]>([]);
  const edgesRef = useRef<BondEdge[]>([]);
  const zoomRef = useRef(1);
  const timeRef = useRef(0);

  /* SMILES parser (same as MoleculeStructure3D) */
  const parseSmiles = (smilesStr: string) => {
    const nodes: AtomNode[] = [];
    const edges: BondEdge[] = [];
    if (!smilesStr) return { nodes, edges };

    const ringMap: Record<string, number> = {};
    const branchStack: number[] = [];
    let parentIndex: number | null = null;
    let nextBondType = "single";

    let i = 0;
    while (i < smilesStr.length) {
      const char = smilesStr[i];

      if (char === "(") { if (parentIndex !== null) branchStack.push(parentIndex); i++; continue; }
      if (char === ")") { const p = branchStack.pop(); if (p !== undefined) parentIndex = p; i++; continue; }
      if (char === "=") { nextBondType = "double"; i++; continue; }
      if (char === "#") { nextBondType = "triple"; i++; continue; }
      if (char === ":") { nextBondType = "aromatic"; i++; continue; }

      let ringNum: string | null = null;
      if (char >= "0" && char <= "9") { ringNum = char; i++; }
      else if (char === "%") { ringNum = smilesStr.slice(i + 1, i + 3); i += 3; }

      if (ringNum !== null && nodes.length > 0) {
        const idx = nodes.length - 1;
        if (ringMap[ringNum] !== undefined) {
          const src = ringMap[ringNum];
          if (!edges.some(e => (e.source === src && e.target === idx) || (e.source === idx && e.target === src))) {
            edges.push({ source: src, target: idx, type: nextBondType });
          }
          delete ringMap[ringNum];
        } else {
          ringMap[ringNum] = idx;
        }
        nextBondType = "single";
        continue;
      }

      let matchedAtom: string | null = null;
      let stepSize = 1;

      if (char === "[") {
        const end = smilesStr.indexOf("]", i);
        if (end !== -1) {
          const contents = smilesStr.slice(i + 1, end);
          const m = contents.match(/[A-Z][a-z]?|[a-z]/);
          matchedAtom = m ? m[0] : contents;
          stepSize = end - i + 1;
        }
      } else {
        if (i + 1 < smilesStr.length) {
          const dc = smilesStr.slice(i, i + 2);
          if (dc === "Cl" || dc === "Br") { matchedAtom = dc; stepSize = 2; }
        }
        if (!matchedAtom) {
          const m = char.match(/[BCNOPSFIcno]/);
          if (m) { matchedAtom = m[0]; stepSize = 1; }
        }
      }

      if (matchedAtom) {
        const id = nodes.length;
        const style = ATOM_STYLES[matchedAtom] || { color: "#d1d5db", radius: 7 };
        const angle = (id * 0.72) % (Math.PI * 2);
        const distance = 25 + id * 4;

        nodes.push({
          id,
          element: matchedAtom,
          color: style.color,
          radius: style.radius,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          z: (id % 2 === 0 ? 1 : -1) * (8 + (id % 3) * 4),
          vx: 0, vy: 0, vz: 0,
          charge: ELECTRONEGATIVITY[matchedAtom] || 2.5,
        });

        if (parentIndex !== null) {
          const isAromatic = (matchedAtom.toLowerCase() === matchedAtom) &&
            (nodes[parentIndex].element.toLowerCase() === nodes[parentIndex].element);
          edges.push({
            source: parentIndex,
            target: id,
            type: isAromatic ? "aromatic" : nextBondType,
          });
          nextBondType = "single";
        }
        parentIndex = id;
        i += stepSize;
      } else {
        i++;
      }
    }
    return { nodes, edges };
  };

  const runSimulation = (nodes: AtomNode[], edges: BondEdge[]) => {
    const kRep = 400, kSpring = 0.07, restLen = 32, gravity = 0.015, damping = 0.85;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const u = nodes[i], v = nodes[j];
        const dx = u.x - v.x, dy = u.y - v.y, dz = u.z - v.z;
        const distSq = dx * dx + dy * dy + dz * dz + 0.1;
        const dist = Math.sqrt(distSq);
        if (dist < 100) {
          const f = kRep / distSq;
          u.vx += (dx / dist) * f; u.vy += (dy / dist) * f; u.vz += (dz / dist) * f;
          v.vx -= (dx / dist) * f; v.vy -= (dy / dist) * f; v.vz -= (dz / dist) * f;
        }
      }
    }
    for (const e of edges) {
      const u = nodes[e.source], v = nodes[e.target];
      const dx = u.x - v.x, dy = u.y - v.y, dz = u.z - v.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
      const disp = dist - restLen;
      const f = kSpring * disp;
      u.vx -= (dx / dist) * f; u.vy -= (dy / dist) * f; u.vz -= (dz / dist) * f;
      v.vx += (dx / dist) * f; v.vy += (dy / dist) * f; v.vz += (dz / dist) * f;
    }
    for (const n of nodes) {
      n.vx -= n.x * gravity;
      n.vy -= n.y * gravity;
      n.vz -= n.z * gravity;
      n.x += n.vx; n.y += n.vy; n.z += n.vz;
      n.vx *= damping; n.vy *= damping; n.vz *= damping;
    }
  };

  useEffect(() => {
    const { nodes, edges } = parseSmiles(smiles);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    for (let i = 0; i < 150; i++) runSimulation(nodes, edges);
  }, [smiles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const fov = 300;
    let frameId: number;

    const render = () => {
      timeRef.current += 0.02;
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      if (nodes.length === 0) {
        frameId = requestAnimationFrame(render);
        return;
      }

      if (autoRotate && !isDraggingRef.current) {
        rotationRef.current.y += 0.005;
      }

      const cosY = Math.cos(rotationRef.current.y);
      const sinY = Math.sin(rotationRef.current.y);
      const cosX = Math.cos(rotationRef.current.x);
      const sinX = Math.sin(rotationRef.current.x);
      const zScale = zoomRef.current * 1.4;

      let kineticEnergy = 0;
      for (const n of nodes) kineticEnergy += n.vx * n.vx + n.vy * n.vy + n.vz * n.vz;
      if (kineticEnergy > 0.05) runSimulation(nodes, edges);

      const rotatedNodes = nodes.map((node) => {
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.x * sinY + node.z * cosY;
        const y2 = node.y * cosX - z1 * sinX;
        const z2 = node.y * sinX + z1 * cosX;
        const proj = fov / (fov + z2);
        return {
          ...node,
          rx: x1, ry: y2, rz: z2,
          sx: width / 2 + x1 * proj * zScale,
          sy: height / 2 + y2 * proj * zScale,
          scale: proj * zScale,
        };
      });

      /* Holographic scan lines */
      const scanY = (timeRef.current * 60) % (height + 100) - 50;
      ctx.save();
      ctx.globalAlpha = 0.03;
      for (let i = 0; i < 5; i++) {
        const lineY = scanY + i * 20;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(width, lineY + 10);
        ctx.strokeStyle = "#4F8EF7";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      /* Draw bonds with glow */
      for (const edge of edges) {
        const u = rotatedNodes[edge.source];
        const v = rotatedNodes[edge.target];
        const avgDepth = (u.rz + v.rz) / 2;
        const opacity = Math.max(0.15, Math.min(1.0, (fov - avgDepth) / fov));

        const isHovered = hoveredBond &&
          ((hoveredBond.source === edge.source && hoveredBond.target === edge.target) ||
           (hoveredBond.source === edge.target && hoveredBond.target === edge.source));

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(u.sx, u.sy);
        ctx.lineTo(v.sx, v.sy);

        if (isHovered) {
          ctx.shadowColor = "rgba(79, 142, 247, 0.6)";
          ctx.shadowBlur = 12;
        }

        if (edge.type === "double") {
          ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.7})`;
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(u.sx, u.sy);
          ctx.lineTo(v.sx, v.sy);
          ctx.strokeStyle = "#080c15";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (edge.type === "triple") {
          ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.7})`;
          ctx.lineWidth = 7;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(u.sx, u.sy);
          ctx.lineTo(v.sx, v.sy);
          ctx.strokeStyle = "#080c15";
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (edge.type === "aromatic") {
          ctx.strokeStyle = `rgba(123,97,255,${opacity * 0.7})`;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          if (isHovered) {
            const grad = ctx.createLinearGradient(u.sx, u.sy, v.sx, v.sy);
            grad.addColorStop(0, "#4F8EF7");
            grad.addColorStop(0.5, "#00D4FF");
            grad.addColorStop(1, "#4F8EF7");
            ctx.strokeStyle = grad;
          } else {
            const grad = ctx.createLinearGradient(u.sx, u.sy, v.sx, v.sy);
            grad.addColorStop(0, u.color);
            grad.addColorStop(1, v.color);
            ctx.strokeStyle = grad;
          }
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      /* Atoms with ESP coloring and holographic glow */
      const sorted = [...rotatedNodes].sort((a, b) => b.rz - a.rz);
      for (const node of sorted) {
        const radius = Math.max(2, node.radius * node.scale);
        const brightness = Math.max(0.5, Math.min(1.2, (fov - node.rz) / fov));

        const hexToRgb = (hex: string) => {
          const m = hex.replace(/^#?/, "").match(/.{2}/g);
          return m ? m.map(x => parseInt(x, 16)) : [156, 163, 175];
        };

        let colorHex = node.color;
        if (showESP && node.charge) {
          const avgEN = 2.8;
          const diff = node.charge - avgEN;
          if (diff > 0.3) colorHex = "#ef4444";
          else if (diff < -0.3) colorHex = "#3b82f6";
          else colorHex = node.color;
        }

        const [r, g, b] = hexToRgb(colorHex);
        const rgbStr = `${Math.floor(r * brightness)}, ${Math.floor(g * brightness)}, ${Math.floor(b * brightness)}`;

        /* Glow */
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgbStr}, 0.08)`;
        ctx.filter = "blur(4px)";
        ctx.fill();
        ctx.restore();

        /* Atom body */
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, radius, 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(
          node.sx - radius * 0.3, node.sy - radius * 0.3, radius * 0.1,
          node.sx, node.sy, radius
        );
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, `rgb(${rgbStr})`);
        grad.addColorStop(1, `rgb(${Math.floor(r * brightness * 0.5)}, ${Math.floor(g * brightness * 0.5)}, ${Math.floor(b * brightness * 0.5)})`);

        ctx.fillStyle = grad;
        ctx.fill();

        /* Holographic rim light */
        ctx.beginPath();
        ctx.arc(node.sx - radius * 0.2, node.sy - radius * 0.2, radius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, 0.06)`;
        ctx.fill();
        ctx.restore();

        /* Element label */
        if (radius > 8 && node.element !== "H") {
          ctx.save();
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.floor(radius * 0.9)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,0,0,0.7)";
          ctx.shadowBlur = 3;
          ctx.fillText(node.element.toUpperCase(), node.sx, node.sy);
          ctx.restore();
        }
      }

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [smiles, width, height, autoRotate, showESP, hoveredBond]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!interactive) return;
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      rotationRef.current.y += dx * 0.007;
      rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x + dy * 0.007));
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }

    /* Bond hover detection */
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    let found: { source: number; target: number } | null = null;
    for (const edge of edges) {
      const u = nodes[edge.source];
      const v = nodes[edge.target];
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;
      const t = ((mx - u.x) * dx + (my - u.y) * dy) / (len * len);
      if (t < 0 || t > 1) continue;
      const px = u.x + t * dx;
      const py = u.y + t * dy;
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (dist < 10) { found = { source: edge.source, target: edge.target }; break; }
    }
    setHoveredBond(found);
  };

  const handleMouseUp = () => { isDraggingRef.current = false; };
  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    const dir = e.deltaY > 0 ? -1 : 1;
    zoomRef.current = Math.max(0.4, Math.min(2.5, zoomRef.current + dir * 0.08));
  };

  return (
    <div className={styles.container} style={{ width, height }}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ width, height }}
      />
      <div className={styles.controls}>
        <button className={styles.ctrlBtn} onClick={() => setAutoRotate(!autoRotate)} title={autoRotate ? "Pause" : "Auto-rotate"}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {autoRotate ? (
              <><rect x="3" y="3" width="2.5" height="8" rx="1" fill="currentColor"/><rect x="8.5" y="3" width="2.5" height="8" rx="1" fill="currentColor"/></>
            ) : (
              <><polygon points="4,3 11,7 4,11" fill="currentColor"/></>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
