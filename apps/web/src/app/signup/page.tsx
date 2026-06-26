"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import styles from "./page.module.css";

const USER_TYPES = [
  { value: "academic", label: "Academic Researcher" },
  { value: "industry", label: "Industry Scientist" },
  { value: "student", label: "Student (PhD / Masters)" },
  { value: "bioinformatician", label: "Bioinformatician" },
  { value: "clinician", label: "Clinician / Physician" },
  { value: "other", label: "Other" },
];

const USAGE_INTENTS = [
  { value: "drug-discovery", label: "Drug Discovery & Development" },
  { value: "target-id", label: "Target Identification" },
  { value: "molecular-modeling", label: "Molecular Modeling" },
  { value: "education", label: "Education & Teaching" },
  { value: "lit-review", label: "Literature Review" },
  { value: "other", label: "Other" },
];

const REFERRAL_SOURCES = [
  { value: "google", label: "Google Search" },
  { value: "twitter", label: "Twitter / X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "github", label: "GitHub" },
  { value: "conference", label: "Conference / Webinar" },
  { value: "colleague", label: "Colleague / Referral" },
  { value: "blog", label: "Blog / Publication" },
  { value: "other", label: "Other" },
];

export default function SignupPage() {
  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Researcher");
  const [organization, setOrganization] = useState("");
  const [userType, setUserType] = useState("");
  const [usageIntent, setUsageIntent] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const dots = Array.from({ length: 30 }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 2.5 + 1, alpha: Math.random() * 0.3 + 0.1,
    }));

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 150) {
            ctx.strokeStyle = `rgba(124, 58, 237, ${(1 - d / 150) * 0.05})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }
      dots.forEach((dot) => {
        dot.x += dot.vx; dot.y += dot.vy;
        if (dot.x < 0 || dot.x > width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > height) dot.vy *= -1;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124, 58, 237, ${dot.alpha})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName || !organization) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await signup(email, password, displayName, role, organization, userType, usageIntent, referralSource);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!displayName || !email || !organization)) {
      setError("Please fill in all fields before continuing.");
      return;
    }
    setError(null);
    setStep(2);
  };

  return (
    <div className={styles.page}>
      <div className={styles.ambientGlow1} />
      <div className={styles.ambientGlow2} />
      <canvas ref={canvasRef} className={styles.canvas} />

      <main className={styles.main}>
        <div className={styles.branding}>
          <div className={styles.logoWrapper}>
            <img src="/logo.png" alt="MoleCraft Logo" className={styles.logo} />
            <h1 className={styles.title}>Create Profile</h1>
          </div>
          <p className={styles.tagline}>Join the AI-powered drug discovery platform</p>
        </div>

        <div className={styles.steps}>
          <span className={`${styles.stepDot} ${step >= 1 ? styles.stepActive : ""}`}>1</span>
          <span className={styles.stepLine} />
          <span className={`${styles.stepDot} ${step >= 2 ? styles.stepActive : ""}`}>2</span>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <svg className={styles.errorIcon} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {step === 1 && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="displayName" className={styles.label}>Full Name</label>
                <div className={styles.inputWrapper}>
                  <div className={styles.icon}>
                    <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                    </svg>
                  </div>
                  <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Dr. Evelyn Harper" className={styles.input} required autoComplete="name" />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="email" className={styles.label}>Institutional Email</label>
                <div className={styles.inputWrapper}>
                  <div className={styles.icon}>
                    <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                      <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                    </svg>
                  </div>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="harper@institution.edu" className={styles.input} required autoComplete="email" />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="organization" className={styles.label}>Organization / Lab</label>
                <div className={styles.inputWrapper}>
                  <div className={styles.icon}>
                    <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0h8v2H6V4zm0 4h8v2H6V8zm0 4h8v2H6v-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input id="organization" type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Stanford BioML Group" className={styles.input} required autoComplete="organization" />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="role" className={styles.label}>Institutional Role</label>
                <div className={styles.selectWrapper}>
                  <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={styles.select}>
                    <option value="Researcher">Computational Chemist (Researcher)</option>
                    <option value="Operator">RAG Operator</option>
                    <option value="Administrator">Platform Administrator</option>
                  </select>
                  <div className={styles.selectArrow}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 9l3 3 3-3" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <div className={styles.inputWrapper}>
                  <div className={styles.icon}>
                    <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={styles.input} required autoComplete="new-password" />
                </div>
              </div>

              <button type="button" className={styles.submitBtn} onClick={nextStep}>Continue →</button>
            </>
          )}

          {step === 2 && (
            <>
              <div className={styles.inputGroup}>
                <label className={styles.label}>What best describes you?</label>
                <div className={styles.optionGrid}>
                  {USER_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`${styles.optionChip} ${userType === t.value ? styles.optionActive : ""}`}
                      onClick={() => setUserType(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Primary usage intent</label>
                <div className={styles.optionGrid}>
                  {USAGE_INTENTS.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      className={`${styles.optionChip} ${usageIntent === u.value ? styles.optionActive : ""}`}
                      onClick={() => setUsageIntent(u.value)}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Where did you hear about us?</label>
                <div className={styles.optionGrid}>
                  {REFERRAL_SOURCES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      className={`${styles.optionChip} ${referralSource === r.value ? styles.optionActive : ""}`}
                      onClick={() => setReferralSource(r.value)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.checkboxRow}>
                <input id="terms" type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className={styles.checkbox} required />
                <label htmlFor="terms" className={styles.checkboxLabel}>
                  I accept the <a href="#" className={styles.termsLink}>Terms of Service</a> and <a href="#" className={styles.termsLink}>Privacy Policy</a>.
                </label>
              </div>

              <div className={styles.btnRow}>
                <button type="button" className={styles.backBtn} onClick={() => setStep(1)}>← Back</button>
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </button>
              </div>
            </>
          )}
        </form>

        <p className={styles.footer}>
          Already have an account?
          <Link href="/login" className={styles.footerLink}>Sign in instead</Link>
        </p>
      </main>
    </div>
  );
}
