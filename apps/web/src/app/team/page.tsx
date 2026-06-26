"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import styles from "./page.module.css";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  status: string;
  avatar_url: string | null;
}

const ROLES = [
  { value: "admin", label: "Admin", desc: "Full access to all projects and settings" },
  { value: "editor", label: "Editor", desc: "Can create and edit molecules and projects" },
  { value: "viewer", label: "Viewer", desc: "Read-only access to shared projects" },
];

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/team");
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || []);
        }
      } catch (e) {
        console.error("Failed to load team", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sendInvite = async () => {
    if (!inviteEmail) return;
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        toast({ title: "Invitation sent!", type: "success" });
        setShowInvite(false);
        setInviteEmail("");
      }
    } catch (e) {
      console.error("Failed to send invite", e);
    }
  };

  const filtered = members.filter((m) =>
    m.name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Team</h1>
            <p className={styles.desc}>{members.filter((m) => m.status === "active").length} active members</p>
          </div>
          <div className={styles.headerActions}>
            <SearchInput placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button onClick={() => setShowInvite(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Invite Member
            </Button>
          </div>
        </div>

        <div className={styles.grid}>
          {filtered.map((member) => (
            <Card key={member.id} padding="lg" hover>
              <div className={styles.memberCard}>
                <div className={styles.avatar}>{member.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "?"}</div>
                <div className={styles.memberInfo}>
                  <h3 className={styles.memberName}>{member.name}</h3>
                  <p className={styles.memberRole}>{member.role}</p>
                  <p className={styles.memberEmail}>{member.email}</p>
                </div>
                <div className={styles.memberMeta}>
                  <Badge variant={member.status === "active" ? "green" : member.status === "pending" ? "amber" : "default"}>{member.status}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card padding="lg">
          <h2 className={styles.rolesTitle}>Roles & Permissions</h2>
          <div className={styles.rolesGrid}>
            {ROLES.map((role) => (
              <div key={role.value} className={styles.roleCard}>
                <Badge variant="brand">{role.value}</Badge>
                <p className={styles.roleLabel}>{role.label}</p>
                <p className={styles.roleDesc}>{role.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member">
        <div className={styles.modalBody}>
          <Input label="Email Address" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@institution.edu" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>} />
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Role</label>
            <div className={styles.roleSelect}>
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  className={`${styles.roleOption} ${inviteRole === r.value ? styles.roleActive : ""}`}
                  onClick={() => setInviteRole(r.value)}
                >
                  <span className={styles.roleOptionLabel}>{r.label}</span>
                  <span className={styles.roleOptionDesc}>{r.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={sendInvite} disabled={!inviteEmail}>Send Invitation</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
