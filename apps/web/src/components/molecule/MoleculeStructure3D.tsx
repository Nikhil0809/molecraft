"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./MoleculeStructure3D.module.css";

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
}

interface BondEdge {
  source: number;
  target: number;
  type: string; // "single", "double", "triple", "aromatic"
}

interface MoleculeStructure3DProps {
  smiles: string;
}

// Atom color and size mapping
const ATOM_STYLES: Record<string, { color: string; radius: number }> = {
  C: { color: "#9ca3af", radius: 8 }, // Gray
  c: { color: "#6b7280", radius: 8 }, // Aromatic Gray
  O: { color: "#f87171", radius: 7.5 }, // Red
  o: { color: "#ef4444", radius: 7.5 },
  N: { color: "#60a5fa", radius: 8 }, // Blue
  n: { color: "#3b82f6", radius: 8 },
  F: { color: "#34d399", radius: 7 }, // Green
  S: { color: "#fbbf24", radius: 9 }, // Yellow
  s: { color: "#f59e0b", radius: 9 },
  Cl: { color: "#10b981", radius: 9 }, // Chlorine green
  Br: { color: "#b45309", radius: 10 }, // Brown
  I: { color: "#a78bfa", radius: 11 }, // Violet
  H: { color: "#ffffff", radius: 5 }, // White
};

export default function MoleculeStructure3D({ smiles }: MoleculeStructure3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [zoom, setZoom] = useState(1);
  const legendAtoms = useMemo(() => {
    const { nodes } = parseSmiles(smiles);
    return Array.from(new Set(nodes.map(n => {
      const symbol = n.element.toUpperCase();
      return symbol === "C" ? "Carbon (C)" :
             symbol === "O" ? "Oxygen (O)" :
             symbol === "N" ? "Nitrogen (N)" :
             symbol === "F" ? "Fluorine (F)" :
             symbol === "S" ? "Sulfur (S)" :
             symbol === "CL" ? "Chlorine (Cl)" :
             symbol === "BR" ? "Bromine (Br)" :
             symbol === "I" ? "Iodine (I)" : symbol;
    })));
  }, [smiles]);
  
  // Interaction variables (using refs to avoid re-renders during animation loops)
  const rotationRef = useRef({ x: 0.5, y: 0.5 }); // X and Y rotation angles
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const nodesRef = useRef<AtomNode[]>([]);
  const edgesRef = useRef<BondEdge[]>([]);

  // Parse SMILES into a graph
  const parseSmiles = (smilesStr: string) => {
    const nodes: AtomNode[] = [];
    const edges: BondEdge[] = [];
    
    if (!smilesStr) return { nodes, edges };

    // Basic tokenizer for SMILES
    const ringMap: Record<string, number> = {}; // Tracks ring closures
    const branchStack: number[] = []; // Parent node index stack for branching
    
    let parentIndex: number | null = null;
    let nextBondType = "single";

    let i = 0;
    while (i < smilesStr.length) {
      const char = smilesStr[i];

      if (char === "(") {
        if (parentIndex !== null) {
          branchStack.push(parentIndex);
        }
        i++;
        continue;
      }

      if (char === ")") {
        const popped = branchStack.pop();
        if (popped !== undefined) {
          parentIndex = popped;
        }
        i++;
        continue;
      }

      // Bond specifiers
      if (char === "=") {
        nextBondType = "double";
        i++;
        continue;
      }
      if (char === "#") {
        nextBondType = "triple";
        i++;
        continue;
      }
      if (char === ":") {
        nextBondType = "aromatic";
        i++;
        continue;
      }

      // Ring closures (single digit 0-9 or % followed by 2 digits)
      let ringNum: string | null = null;
      if (char >= "0" && char <= "9") {
        ringNum = char;
        i++;
      } else if (char === "%") {
        ringNum = smilesStr.slice(i + 1, i + 3);
        i += 3;
      }

      if (ringNum !== null && nodes.length > 0) {
        const currentAtomIdx = nodes.length - 1;
        if (ringMap[ringNum] !== undefined) {
          // Closure bond
          const sourceIdx = ringMap[ringNum];
          // Check if edge already exists
          if (!edges.some(e => (e.source === sourceIdx && e.target === currentAtomIdx) || (e.source === currentAtomIdx && e.target === sourceIdx))) {
            edges.push({ source: sourceIdx, target: currentAtomIdx, type: nextBondType });
          }
          delete ringMap[ringNum];
        } else {
          // Open ring
          ringMap[ringNum] = currentAtomIdx;
        }
        nextBondType = "single"; // reset
        continue;
      }

      // Match atoms (either bracketed or standard symbols)
      let matchedAtom: string | null = null;
      let stepSize = 1;

      if (char === "[") {
        const endIdx = smilesStr.indexOf("]", i);
        if (endIdx !== -1) {
          const contents = smilesStr.slice(i + 1, endIdx);
          // Look for element symbol inside bracket
          const elemMatch = contents.match(/[A-Z][a-z]?|[a-z]/);
          matchedAtom = elemMatch ? elemMatch[0] : contents;
          stepSize = endIdx - i + 1;
        }
      } else {
        // Look for 2-character atom Cl, Br
        if (i + 1 < smilesStr.length) {
          const doubleChar = smilesStr.slice(i, i + 2);
          if (doubleChar === "Cl" || doubleChar === "Br") {
            matchedAtom = doubleChar;
            stepSize = 2;
          }
        }
        if (!matchedAtom) {
          const singleCharMatch = char.match(/[BCNOPSFIcno]/);
          if (singleCharMatch) {
            matchedAtom = singleCharMatch[0];
            stepSize = 1;
          }
        }
      }

      if (matchedAtom) {
        const nodeId = nodes.length;
        const style = ATOM_STYLES[matchedAtom] || { color: "#d1d5db", radius: 7 };
        
        // Dynamic initial coordinate layout with small random displacement
        const angle = (nodeId * 0.72) % (Math.PI * 2);
        const distance = 30 + nodeId * 5;
        
        nodes.push({
          id: nodeId,
          element: matchedAtom,
          color: style.color,
          radius: style.radius,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          z: (nodeId % 2 === 0 ? 1 : -1) * (10 + (nodeId % 3) * 5),
          vx: 0,
          vy: 0,
          vz: 0
        });

        // Add bond with parent
        if (parentIndex !== null) {
          // Aromatic connectivity helper
          const isAromatic = (matchedAtom.toLowerCase() === matchedAtom) && 
                            (nodes[parentIndex].element.toLowerCase() === nodes[parentIndex].element);
          
          edges.push({
            source: parentIndex,
            target: nodeId,
            type: isAromatic ? "aromatic" : nextBondType
          });
          nextBondType = "single"; // reset
        }

        parentIndex = nodeId;
        i += stepSize;
      } else {
        i++; // Skip other symbols (like branching, dots, stereochemistry / \ etc.)
      }
    }

    return { nodes, edges };
  };

  // Run 3D force-directed simulation step
  const runSimulationStep = (nodes: AtomNode[], edges: BondEdge[]) => {
    const kRepulsion = 450;  // Repulsion coefficient
    const kSpring = 0.08;     // Spring stiffness
    const restLength = 35;   // Desired bond distance
    const gravity = 0.02;    // Weak force drawing to center
    const damping = 0.85;    // Friction

    // 1. Repulsion between all atoms
    for (let i = 0; i < nodes.length; i++) {
      const u = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const v = nodes[j];
        
        const dx = u.x - v.x;
        const dy = u.y - v.y;
        const dz = u.z - v.z;
        const distSq = dx * dx + dy * dy + dz * dz + 0.1; // Avoid division by zero
        const dist = Math.sqrt(distSq);

        if (dist < 120) {
          // Repulsion force
          const f = kRepulsion / distSq;
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          const fz = (dz / dist) * f;

          u.vx += fx; u.vy += fy; u.vz += fz;
          v.vx -= fx; v.vy -= fy; v.vz -= fz;
        }
      }
    }

    // 2. Attraction between bonded atoms
    for (const edge of edges) {
      const u = nodes[edge.source];
      const v = nodes[edge.target];

      const dx = u.x - v.x;
      const dy = u.y - v.y;
      const dz = u.z - v.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;

      // Spring displacement
      const displacement = dist - restLength;
      const f = kSpring * displacement;
      
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      const fz = (dz / dist) * f;

      u.vx -= fx; u.vy -= fy; u.vz -= fz;
      v.vx += fx; v.vy += fy; v.vz += fz;
    }

    // 3. Central gravity and update position
    for (const node of nodes) {
      // Pull to origin (0, 0, 0)
      node.vx -= node.x * gravity;
      node.vy -= node.y * gravity;
      node.vz -= node.z * gravity;

      // Apply velocity
      node.x += node.vx;
      node.y += node.vy;
      node.z += node.vz;

      // Friction
      node.vx *= damping;
      node.vy *= damping;
      node.vz *= damping;
    }
  };

  useEffect(() => {
    const { nodes, edges } = parseSmiles(smiles);
    nodesRef.current = nodes;
    edgesRef.current = edges;

    for (let i = 0; i < 180; i++) {
      runSimulationStep(nodes, edges);
    }
  }, [smiles]);

  // Main Canvas Render loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const fov = 350; // Perspective parameter

    const render = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Clear with dark-mode gradient backdrop
      ctx.clearRect(0, 0, width, height);
      
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      if (nodes.length === 0) {
        ctx.fillStyle = "#4b5563";
        ctx.font = "14px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Generating molecular matrix...", width / 2, height / 2);
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // 1. Slow continuous auto-rotation if active
      if (autoRotate && !isDraggingRef.current) {
        rotationRef.current.y += 0.006;
      }

      // Rotate coordinates around Y and X axes
      const cosY = Math.cos(rotationRef.current.y);
      const sinY = Math.sin(rotationRef.current.y);
      const cosX = Math.cos(rotationRef.current.x);
      const sinX = Math.sin(rotationRef.current.x);

      // Perform matrix rotation on copies of nodes
      const rotatedNodes = nodes.map(node => {
        // Rotate around Y-axis
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.x * sinY + node.z * cosY;

        // Rotate around X-axis
        const y2 = node.y * cosX - z1 * sinX;
        const z2 = node.y * sinX + z1 * cosX;

        // Perspective scaling
        const zoomScale = zoom * 1.5;
        const projScale = fov / (fov + z2);
        const finalScale = projScale * zoomScale;

        return {
          ...node,
          rx: x1,
          ry: y2,
          rz: z2,
          sx: width / 2 + x1 * finalScale,
          sy: height / 2 + y2 * finalScale,
          scale: finalScale
        };
      });

      // Run force simulation step continuously if still settling
      // Check if velocity is low; if not, run simulation to adjust coordinates in 3D
      let kineticEnergy = 0;
      for (const n of nodes) {
        kineticEnergy += n.vx * n.vx + n.vy * n.vy + n.vz * n.vz;
      }
      if (kineticEnergy > 0.05 || isDraggingRef.current) {
        runSimulationStep(nodes, edges);
      }

      // 2. Draw bonds (depth-sorted or drawn below atoms for clean look)
      ctx.lineWidth = 2.5;
      
      for (const edge of edges) {
        const u = rotatedNodes[edge.source];
        const v = rotatedNodes[edge.target];

        // Midpoint depth for sorting / transparency
        const avgDepth = (u.rz + v.rz) / 2;
        const opacity = Math.max(0.15, Math.min(1.0, (fov - avgDepth) / fov));

        // Draw line with chemical bond details
        ctx.beginPath();
        ctx.moveTo(u.sx, u.sy);
        ctx.lineTo(v.sx, v.sy);

        if (edge.type === "double") {
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
          ctx.lineWidth = 6;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(u.sx, u.sy);
          ctx.lineTo(v.sx, v.sy);
          ctx.strokeStyle = "#080c15";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (edge.type === "triple") {
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
          ctx.lineWidth = 8;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(u.sx, u.sy);
          ctx.lineTo(v.sx, v.sy);
          ctx.strokeStyle = "#080c15";
          ctx.lineWidth = 4;
          ctx.stroke();
        } else if (edge.type === "aromatic") {
          ctx.strokeStyle = `rgba(123, 97, 255, ${opacity * 0.7})`; // purple tint for aromatic bonds
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
        } else {
          // Standard single bond
          const grad = ctx.createLinearGradient(u.sx, u.sy, v.sx, v.sy);
          grad.addColorStop(0, u.color);
          grad.addColorStop(1, v.color);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      // 3. Draw Atoms (Painter's algorithm: sort by rz descending so further elements are rendered first)
      const sortedNodes = [...rotatedNodes].sort((a, b) => b.rz - a.rz);

      for (const node of sortedNodes) {
        const radius = node.radius * node.scale;
        
        // Depth-dependent lighting/shading
        const brightness = Math.max(0.5, Math.min(1.2, (fov - node.rz) / fov));
        
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, Math.max(2, radius), 0, Math.PI * 2);

        // 3D Spherical Radial Gradient
        const grad = ctx.createRadialGradient(
          node.sx - radius * 0.3,
          node.sy - radius * 0.3,
          radius * 0.1,
          node.sx,
          node.sy,
          radius
        );
        
        // Modulate color brightness
        const hexToRgb = (hex: string) => {
          const match = hex.replace(/^#?/, "").match(/.{2}/g);
          return match ? match.map(x => parseInt(x, 16)) : [156, 163, 175];
        };
        const [r, g, b] = hexToRgb(node.color);
        const rgbStr = `${Math.floor(r * brightness)}, ${Math.floor(g * brightness)}, ${Math.floor(b * brightness)}`;
        
        grad.addColorStop(0, "#ffffff"); // Highlight
        grad.addColorStop(0.3, `rgb(${rgbStr})`);
        grad.addColorStop(1, `rgb(${Math.floor(r * brightness * 0.6)}, ${Math.floor(g * brightness * 0.6)}, ${Math.floor(b * brightness * 0.6)})`); // Shading

        ctx.fillStyle = grad;
        ctx.fill();

        // Draw element letter overlay
        if (radius > 9 && node.element !== "H") {
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.floor(radius * 1.1)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // Shadow
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 2;
          ctx.fillText(node.element.toUpperCase(), node.sx, node.sy);
          ctx.shadowBlur = 0; // Reset
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [autoRotate, zoom]);

  // Mouse Handlers for rotation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;

    rotationRef.current.y += deltaX * 0.007;
    rotationRef.current.x += deltaY * 0.007;

    // Enforce constraints on X rotation to prevent flipping upside down
    rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    setZoom(prev => Math.max(0.4, Math.min(2.5, prev + direction * 0.08)));
  };

  const handleReset = () => {
    rotationRef.current = { x: 0.5, y: 0.5 };
    setZoom(1);
  };

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      {/* Legend Overlay */}
      <div className={styles.legend}>
        {legendAtoms.map((text, idx) => {
          const char = text.charAt(text.indexOf("(") + 1) || "C";
          const style = ATOM_STYLES[char] || ATOM_STYLES[char.toLowerCase()] || { color: "#d1d5db" };
          return (
            <div key={idx} className={styles.legendItem}>
              <div className={styles.legendDot} style={{ backgroundColor: style.color }} />
              <span>{text}</span>
            </div>
          );
        })}
      </div>

      {/* Manual Controls */}
      <div className={styles.controls}>
        <button
          className={styles.btn}
          onClick={() => setAutoRotate(!autoRotate)}
          title={autoRotate ? "Pause Auto-Rotation" : "Resume Auto-Rotation"}
        >
          {autoRotate ? "⏸" : "▶"}
        </button>
        <button className={styles.btn} onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} title="Zoom In">
          ＋
        </button>
        <button className={styles.btn} onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} title="Zoom Out">
          －
        </button>
        <button className={styles.btn} onClick={handleReset} title="Reset View">
          ↺
        </button>
      </div>

      <div className={styles.instructions}>
        <span>🖱</span>
        <span>Drag to rotate | Scroll to zoom</span>
      </div>
    </div>
  );
}
