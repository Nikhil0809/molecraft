"use client";

import { useCallback, useRef, useState } from "react";

interface PanZoomState {
  x: number;
  y: number;
  scale: number;
}

interface UsePanZoomReturn {
  viewport: PanZoomState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  handleWheel: (e: React.WheelEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  resetView: () => void;
  zoomTo: (cx: number, cy: number, targetScale: number) => void;
  panTo: (x: number, y: number) => void;
}

const MIN_SCALE = 0.08;
const MAX_SCALE = 8;
const ZOOM_SENSITIVITY = 0.0015;
const FRICTION = 0.9;
const INERTIA_THRESHOLD = 0.3;
const ZOOM_INERTIA_DECAY = 0.85;

export function usePanZoom(
  initialScale = 1,
  initialX = 0,
  initialY = 0
): UsePanZoomReturn {
  const [viewport, setViewport] = useState<PanZoomState>({
    x: initialX,
    y: initialY,
    scale: initialScale,
  });

  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const zoomVelocity = useRef(0);
  const animFrame = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const applyInertia = useCallback(function applyInertiaFn() {
    const v = velocity.current;
    const zv = zoomVelocity.current;

    if (
      Math.abs(v.x) < INERTIA_THRESHOLD &&
      Math.abs(v.y) < INERTIA_THRESHOLD &&
      Math.abs(zv) < 0.001
    ) {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      animFrame.current = null;
      return;
    }

    setViewport((prev) => {
      const newX = prev.x + v.x;
      const newY = prev.y + v.y;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale + zv));

      return { x: newX, y: newY, scale: newScale };
    });

    v.x *= FRICTION;
    v.y *= FRICTION;
    zoomVelocity.current *= ZOOM_INERTIA_DECAY;

    animFrame.current = requestAnimationFrame(applyInertiaFn);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport((prev) => {
      const delta = -e.deltaY * ZOOM_SENSITIVITY * prev.scale;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * (1 + delta / prev.scale)));

      const scaleChange = newScale / prev.scale;
      const newX = mouseX - (mouseX - prev.x) * scaleChange;
      const newY = mouseY - (mouseY - prev.y) * scaleChange;

      zoomVelocity.current = (newScale - prev.scale) * 0.3;

      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: 0, y: 0 };
    zoomVelocity.current = 0;
    if (animFrame.current) {
      cancelAnimationFrame(animFrame.current);
      animFrame.current = null;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    velocity.current = { x: dx * 0.6, y: dy * 0.6 };

    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (
      Math.abs(velocity.current.x) > INERTIA_THRESHOLD ||
      Math.abs(velocity.current.y) > INERTIA_THRESHOLD ||
      Math.abs(zoomVelocity.current) > 0.001
    ) {
      applyInertia();
    }
  }, [applyInertia]);

  const resetView = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomTo = useCallback((cx: number, cy: number, targetScale: number) => {
    setViewport((prev) => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetScale));
      const scaleChange = newScale / prev.scale;
      return {
        x: cx - (cx - prev.x) * scaleChange,
        y: cy - (cy - prev.y) * scaleChange,
        scale: newScale,
      };
    });
  }, []);

  const panTo = useCallback((x: number, y: number) => {
    setViewport((prev) => ({ ...prev, x, y }));
  }, []);

  return {
    viewport,
    containerRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetView,
    zoomTo,
    panTo,
  };
}
