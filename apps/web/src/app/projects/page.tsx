"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import styles from "./page.module.css";

const TABS = [
  { id: "all", label: "All Projects" },
  { id: "recent", label: "Recent" },
  { id: "favorites", label: "Favorites" },
  { id: "archived", label: "Archived" },
];

interface Project {
  id: string;
  name: string;
  description: string;
  molecule_count: number;
  status: string;
  updated_at: string;
  favorite: boolean;
  color: string;
}

function ProjectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams({ tab: activeTab, q: search });
        const res = await fetch(`/api/projects?${params}`);
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch (e) {
        console.error("Failed to load projects", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeTab, search]);

  const createProject = async () => {
    if (!newName) return;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (res.ok) {
        toast({ title: "Project created!", type: "success" });
        setShowNew(false);
        setNewName("");
        setNewDesc("");
        const params = new URLSearchParams({ tab: activeTab, q: search });
        const refresh = await fetch(`/api/projects?${params}`);
        if (refresh.ok) {
          const data = await refresh.json();
          setProjects(data.projects || []);
        }
      }
    } catch (e) {
      console.error("Failed to create project", e);
    }
  };

  const toggleFavorite = async (id: string, current: boolean) => {
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, favorite: !current }),
      });
      const params = new URLSearchParams({ tab: activeTab, q: search });
      const refresh = await fetch(`/api/projects?${params}`);
      if (refresh.ok) {
        const data = await refresh.json();
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error("Failed to toggle favorite", e);
    }
  };

  const filtered = projects.filter((p) => {
    if (activeTab === "favorites" && !p.favorite) return false;
    if (activeTab === "archived") return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      <div className={styles.inner}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Projects</h1>
            <p className={styles.desc}>{filtered.length} projects • {projects.filter((p) => p.status === "active").length} active</p>
          </div>
          <div className={styles.headerActions}>
            <SearchInput placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button icon={<ProjectIcon />} onClick={() => setShowNew(true)}>New Project</Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className={styles.tabs} />

        {/* Grid */}
        <div className={styles.grid}>
          {filtered.map((project) => (
            <Card key={project.id} padding="lg" hover className={styles.projectCard}>
              <div className={styles.projectTop}>
                <div className={styles.projectColor} style={{ background: project.color || "#7C3AED" }} />
                <div className={styles.projectInfo}>
                  <h3 className={styles.projectName}>{project.name}</h3>
                  <p className={styles.projectDesc}>{project.description}</p>
                </div>
                <button
                  className={`${styles.favBtn} ${project.favorite ? styles.favActive : ""}`}
                  onClick={() => toggleFavorite(project.id, project.favorite)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={project.favorite ? "#fbbf24" : "none"} stroke={project.favorite ? "#fbbf24" : "#6b7280"} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                </button>
              </div>
              <div className={styles.projectMeta}>
                <div className={styles.projectStat}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5"><path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.636 5.636l.707.707M17.657 17.657l.707.707M5.636 18.364l.707-.707M17.657 6.343l.707-.707" /><circle cx="12" cy="12" r="4" /></svg>
                  <span>{project.molecule_count} molecules</span>
                </div>
                <div className={styles.projectStat}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span>{project.updated_at ? new Date(project.updated_at).toLocaleDateString() : "recent"}</span>
                </div>
                <Badge variant={project.status === "active" ? "purple" : project.status === "completed" ? "green" : "default"}>{project.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* New Project Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Create New Project">
        <div className={styles.modalBody}>
          <Input label="Project Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. KRAS G12D Inhibitors" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>} />
          <Input label="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief project description..." icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>} />
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createProject} disabled={!newName}>Create Project</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
