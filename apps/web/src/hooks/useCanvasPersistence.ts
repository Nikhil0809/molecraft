"use client";

import { useCallback, useRef } from "react";
import type { WorkspaceNode } from "@/app/workspace/page";
import type { CausalLink } from "@/components/canvas/CausalEdge";

const STORAGE_KEY = "molecraft_canvas_v1";

interface CanvasSnapshot {
  nodes: WorkspaceNode[];
  links: CausalLink[];
  savedAt: number;
  query: string;
}

export function useCanvasPersistence() {
  const loaded = useRef(false);

  const save = useCallback((nodes: WorkspaceNode[], links: CausalLink[], query: string) => {
    try {
      const snapshot: CanvasSnapshot = {
        nodes,
        links,
        savedAt: Date.now(),
        query,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // storage full — silently degrade
    }
  }, []);

  const restore = useCallback((): CanvasSnapshot | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CanvasSnapshot;
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { save, restore, clear, loaded };
}
