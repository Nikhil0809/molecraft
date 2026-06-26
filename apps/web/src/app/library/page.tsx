"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import styles from "./page.module.css";

const TABS = [
  { id: "all", label: "All Molecules" },
  { id: "recent", label: "Recent" },
  { id: "favorites", label: "Favorites" },
  { id: "imported", label: "Imported" },
];

interface LibraryMolecule {
  id: string;
  name: string;
  smiles: string;
  formula: string;
  mw: number;
  source: string;
  date: string;
  favorite: boolean;
}

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case "generated":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5">
          <path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.636 5.636l.707.707M17.657 17.657l.707.707M5.636 18.364l.707-.707M17.657 6.343l.707-.707" />
          <circle cx="12" cy="12" r="4" fill="#7C3AED" fillOpacity="0.1" />
        </svg>
      );
    case "library":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.5">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "imported":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    default:
      return null;
  }
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [molecules, setMolecules] = useState<LibraryMolecule[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams({ tab: activeTab, q: search });
        const res = await fetch(`/api/library?${params}`);
        if (res.ok) {
          const data = await res.json();
          setMolecules(data.molecules || []);
        }
      } catch (e) {
        console.error("Failed to load library", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeTab, search]);

  const filtered = molecules.filter((m) => {
    if (activeTab === "favorites" && !m.favorite) return false;
    if (search && !m.name?.toLowerCase().includes(search.toLowerCase()) && !m.formula?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Molecule Library</h1>
            <p className={styles.desc}>{molecules.length} molecules</p>
          </div>
          <SearchInput placeholder="Search by name or formula..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className={styles.tabs} />

        <div className={styles.grid}>
          {filtered.map((mol) => (
            <Card key={mol.id} padding="md" hover className={styles.molCard}>
              {/* Structure preview placeholder */}
              <div className={styles.structurePreview}>
                <svg viewBox="0 0 120 80" className={styles.structureSvg}>
                  <circle cx="20" cy="40" r="4" fill="#7C3AED" />
                  <circle cx="40" cy="20" r="4" fill="#06B6D4" />
                  <circle cx="60" cy="40" r="4" fill="#7C3AED" />
                  <circle cx="80" cy="20" r="4" fill="#06B6D4" />
                  <circle cx="100" cy="40" r="4" fill="#7C3AED" />
                  <circle cx="80" cy="60" r="4" fill="#10b981" />
                  <circle cx="40" cy="60" r="4" fill="#f59e0b" />
                  <line x1="24" y1="40" x2="36" y2="24" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <line x1="44" y1="24" x2="56" y2="36" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <line x1="64" y1="36" x2="76" y2="24" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <line x1="84" y1="24" x2="96" y2="36" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <line x1="56" y1="44" x2="76" y2="56" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <line x1="44" y1="56" x2="36" y2="52" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <line x1="60" y1="40" x2="40" y2="40" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 2" />
                </svg>
              </div>

              <div className={styles.molInfo}>
                <div className={styles.molTop}>
                  <h3 className={styles.molName}>{mol.name || "Unnamed"}</h3>
                  <SourceIcon source={mol.source || "imported"} />
                </div>
                <p className={styles.molFormula}>{mol.formula || ""}</p>
                <div className={styles.molStats}>
                  <span className={styles.molStat}>MW {mol.mw ? mol.mw.toFixed(0) : "—"}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
