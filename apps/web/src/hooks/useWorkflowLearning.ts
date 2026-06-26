"use client";

import { useCallback, useEffect, useState } from "react";

interface WorkflowPattern {
  action: string;
  count: number;
  confidence: number;
}

interface UserPreferences {
  autoExpandADMET: boolean;
  showLiveFeeds: boolean;
  preferredLayout: "freeform" | "matrix" | "timeline";
  frequentlyUsedSources: string[];
}

const STORAGE_KEY = "molecraft_workflow_v5";

export function useWorkflowLearning() {
  const defaultPreferences = (): UserPreferences => ({
    autoExpandADMET: false,
    showLiveFeeds: false,
    preferredLayout: "freeform",
    frequentlyUsedSources: [],
  });

  const [patterns, setPatterns] = useState<WorkflowPattern[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (typeof window === "undefined") return defaultPreferences();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return defaultPreferences();
  });

  const recordAction = useCallback((action: string, target: string) => {
    setPatterns((prev) => {
      const existing = prev.find((p) => p.action === action);
      if (existing) {
        return prev.map((p) =>
          p.action === action ? { ...p, count: p.count + 1, confidence: Math.min(1, (p.count + 1) / 10) } : p
        );
      }
      return [...prev, { action, count: 1, confidence: 0.1 }];
    });

    if (action === "view_admet" && target.startsWith("mol_")) {
      const viewCount = patterns.find((p) => p.action === "view_admet")?.count || 0;
      if (viewCount >= 2) {
        setPreferences((prev) => ({ ...prev, autoExpandADMET: true }));
      }
    }

    if (action === "use_source") {
      setPreferences((prev) => {
        const updated = [target, ...prev.frequentlyUsedSources.filter((s) => s !== target)].slice(0, 5);
        return { ...prev, frequentlyUsedSources: updated, showLiveFeeds: updated.length >= 2 };
      });
    }
  }, [patterns]);

  const suggestLayout = useCallback((moleculeCount: number): string | null => {
    if (moleculeCount >= 5 && preferences.preferredLayout !== "matrix") {
      return "You're comparing multiple candidates — switch to comparison matrix view?";
    }
    return null;
  }, [preferences.preferredLayout]);

  const setLayout = useCallback((layout: UserPreferences["preferredLayout"]) => {
    setPreferences((prev) => ({ ...prev, preferredLayout: layout }));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }
  }, [preferences]);

  return {
    patterns,
    preferences,
    recordAction,
    suggestLayout,
    setLayout,
  };
}
