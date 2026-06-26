"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import styles from "../login/page.module.css";

export default function SignupPage() {
  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Researcher");
  const [organization, setOrganization] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName || !organization) {
      setError("Please fill in all fields.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await signup(email, password, displayName, role, organization);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⬢</span>
            <span className={styles.logoText}>MoleCraft v4</span>
          </div>
          <h1 className={styles.title}>Register Researcher Profile</h1>
          <p className={styles.subtitle}>Create your profile to start generating molecules</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorBanner}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="displayName" className={styles.label}>
              Full Name
            </label>
            <input
              id="displayName"
              type="text"
              placeholder="Dr. Evelyn Harper"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="e.harper@biotech.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="organization" className={styles.label}>
              Organization
            </label>
            <input
              id="organization"
              type="text"
              placeholder="Novartis / Broad Institute"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="role" className={styles.label}>
              Institutional Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={styles.select}
            >
              <option value="Researcher">Computational Chemist (Researcher)</option>
              <option value="Operator">RAG Operator</option>
              <option value="Administrator">Platform Administrator</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting ? "Creating Profile..." : "Register Profile"}
          </button>
        </form>

        <div className={styles.footer}>
          Already registered?
          <Link href="/login" className={styles.link}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
