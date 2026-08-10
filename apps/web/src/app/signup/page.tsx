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

const ONBOARD_QUESTIONS = [
  { key: "professionalRole", title: "What best describes you?", options: USER_TYPES, placeholder: "Academic Researcher" },
  { key: "usageIntent", title: "What will you primarily use MoleCraft for?", options: USAGE_INTENTS, placeholder: "Drug Discovery & Development" },
  { key: "referralSource", title: "Where did you hear about us?", options: REFERRAL_SOURCES, placeholder: "GitHub" },
];

type Phase = "form" | "onboarding" | "done";

type FieldKey = "name" | "email" | "organization" | "password" | "terms";
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getPasswordStrength = (value: string): { level: number; label: string } => {
  if (!value) return { level: 0, label: "" };
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length >= 12) score += 1;
  const level = Math.min(score, 3);
  return { level, label: ["", "Weak", "Fair", "Strong"][level] ?? "" };
};

export default function SignupPage() {
  const { signup, beginOnboarding, finishOnboarding } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Researcher");
  const [organization, setOrganization] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [onboardStep, setOnboardStep] = useState(0);
  const [onboardLeaving, setOnboardLeaving] = useState(false);
  const [onboardAnswers, setOnboardAnswers] = useState<Record<string, string | null>>({});
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

    const dotCount = window.matchMedia("(max-width: 480px)").matches ? 12 : 30;
    const dots = Array.from({ length: dotCount }, () => ({
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

  const strength = getPasswordStrength(password);

  const validateField = (key: FieldKey): string => {
    let message = "";
    switch (key) {
      case "name":
        if (!displayName.trim()) message = "Full name is required.";
        else if (displayName.trim().length < 2) message = "Please enter your full legal name.";
        break;
      case "email":
        if (!email.trim()) message = "Email is required.";
        else if (!EMAIL_RE.test(email.trim())) message = "Enter a valid institutional email.";
        break;
      case "organization":
        if (!organization.trim()) message = "Organization or lab is required.";
        break;
      case "password":
        if (!password) message = "Password is required.";
        else if (password.length < 8) message = "Use at least 8 characters.";
        break;
      case "terms":
        if (!agreeTerms) message = "You must agree to the Terms of Service and Privacy Policy.";
        break;
    }
    setFieldErrors((prev) => ({ ...prev, [key]: message }));
    return message;
  };

  const clearFieldError = (key: FieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: FieldErrors = {};
    errors.name = validateField("name");
    errors.email = validateField("email");
    errors.organization = validateField("organization");
    errors.password = validateField("password");
    errors.terms = validateField("terms");
    setFieldErrors(errors);

    const hasEmptyRequired = !displayName.trim() || !email.trim() || !organization.trim() || !password;
    if (hasEmptyRequired) {
      setError("Please fill in all required fields.");
      return;
    }
    if (errors.email === "Enter a valid institutional email.") {
      setError("Please enter a valid email address.");
      return;
    }
    if (errors.terms) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    if (Object.values(errors).some(Boolean)) {
      setError("Please review the highlighted fields.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      beginOnboarding();
      await signup(email, password, displayName, role, organization);
      setPhase("onboarding");
    } catch (err: unknown) {
      finishOnboarding();
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeOnboarding = async (answers: Record<string, string | null>) => {
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalRole: answers.professionalRole ?? null,
          usageIntent: answers.usageIntent ?? null,
          referralSource: answers.referralSource ?? null,
        }),
      });
    } catch {}
    setPhase("done");
    window.setTimeout(() => finishOnboarding(), 1200);
  };

  const answerQuestion = (value: string) => {
    const key = ONBOARD_QUESTIONS[onboardStep].key;
    const answers = { ...onboardAnswers, [key]: value };

    if (onboardStep < ONBOARD_QUESTIONS.length - 1) {
      setOnboardLeaving(true);
      window.setTimeout(() => {
        setOnboardAnswers(answers);
        setOnboardStep((s) => s + 1);
        setOnboardLeaving(false);
      }, 240);
    } else {
      setOnboardAnswers(answers);
      completeOnboarding(answers);
    }
  };

  const skipQuestion = () => answerQuestion("");

  const question = ONBOARD_QUESTIONS[onboardStep];

  return (
    <div className={styles.page}>
      <div className={styles.ambientGlow1} />
      <div className={styles.ambientGlow2} />
      <canvas ref={canvasRef} className={styles.canvas} />

      <main className={styles.main}>
        {phase === "form" && (
          <>
            <div className={styles.branding}>
              <div className={styles.logoWrapper}>
                <img src="/logo.png" alt="MoleCraft Logo" className={styles.logo} />
                <h1 className={styles.title}>Create Profile</h1>
              </div>
              <p className={styles.tagline}>Join the AI-powered drug discovery platform</p>
            </div>

            {error && (
              <div role="alert" className={styles.errorBanner}>
                <svg className={styles.errorIcon} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.inputGroup}>
                <label htmlFor="displayName" className={styles.label}>Full Name</label>
                <div className={`${styles.inputWrapper} ${fieldErrors.name ? styles.inputWrapperError : displayName ? styles.inputWrapperValid : ""}`}>
                  <div className={styles.icon}>
                    <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                    </svg>
                  </div>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); clearFieldError("name"); }}
                    onBlur={() => validateField("name")}
                    placeholder="Dr. Evelyn Harper"
                    className={styles.input}
                    autoComplete="name"
                    aria-invalid={fieldErrors.name ? true : undefined}
                    aria-describedby={fieldErrors.name ? "displayNameError" : undefined}
                  />
                </div>
                {fieldErrors.name && (
                  <span id="displayNameError" className={styles.fieldError}>{fieldErrors.name}</span>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="email" className={styles.label}>Institutional Email</label>
                <div className={`${styles.inputWrapper} ${fieldErrors.email ? styles.inputWrapperError : email ? styles.inputWrapperValid : ""}`}>
                  <div className={styles.icon}>
                    <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                      <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    onBlur={() => validateField("email")}
                    placeholder="harper@institution.edu"
                    className={styles.input}
                    autoComplete="email"
                    aria-invalid={fieldErrors.email ? true : undefined}
                    aria-describedby={fieldErrors.email ? "emailError" : undefined}
                  />
                </div>
                {fieldErrors.email && (
                  <span id="emailError" className={styles.fieldError}>{fieldErrors.email}</span>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="organization" className={styles.label}>Organization / Lab</label>
                <div className={`${styles.inputWrapper} ${fieldErrors.organization ? styles.inputWrapperError : organization ? styles.inputWrapperValid : ""}`}>
                  <div className={styles.icon}>
                    <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0h8v2H6V4zm0 4h8v2H6V8zm0 4h8v2H6v-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="organization"
                    type="text"
                    value={organization}
                    onChange={(e) => { setOrganization(e.target.value); clearFieldError("organization"); }}
                    onBlur={() => validateField("organization")}
                    placeholder="Stanford BioML Group"
                    className={styles.input}
                    autoComplete="organization"
                    aria-invalid={fieldErrors.organization ? true : undefined}
                    aria-describedby={fieldErrors.organization ? "organizationError" : undefined}
                  />
                </div>
                {fieldErrors.organization && (
                  <span id="organizationError" className={styles.fieldError}>{fieldErrors.organization}</span>
                )}
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
                <div className={`${styles.inputWrapper} ${fieldErrors.password ? styles.inputWrapperError : password ? styles.inputWrapperValid : ""}`}>
                  <div className={styles.icon}>
                    <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                    onBlur={() => validateField("password")}
                    placeholder="••••••••"
                    className={`${styles.input} ${styles.inputHasToggle}`}
                    autoComplete="new-password"
                    aria-invalid={fieldErrors.password ? true : undefined}
                    aria-describedby={fieldErrors.password ? "passwordError" : password ? "passwordStrength" : undefined}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
                {fieldErrors.password && (
                  <span id="passwordError" className={styles.fieldError}>{fieldErrors.password}</span>
                )}
                {password && (
                  <div id="passwordStrength" className={styles.strengthMeter}>
                    <div className={styles.strengthBars} aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className={`${styles.strengthBar} ${i < strength.level ? strength.level === 1 ? styles.strengthWeak : strength.level === 2 ? styles.strengthFair : styles.strengthStrong : ""}`}
                        />
                      ))}
                    </div>
                    <span className={styles.strengthLabel} aria-live="polite">{strength.label}</span>
                  </div>
                )}
              </div>

              <div className={styles.checkboxRow}>
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => { setAgreeTerms(e.target.checked); clearFieldError("terms"); }}
                  className={styles.checkbox}
                  aria-invalid={fieldErrors.terms ? true : undefined}
                />
                <label htmlFor="terms" className={styles.checkboxLabel}>
                  I accept the <a href="#" className={styles.termsLink} onClick={(e) => e.preventDefault()}>Terms of Service</a> and <a href="#" className={styles.termsLink} onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
                </label>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <div className={styles.trustRow}>
              <span className={styles.trustItem}><i className="fa-solid fa-shield-halved" /> Open Source (MIT)</span>
              <span className={styles.trustItem}><i className="fa-solid fa-lock" /> Encrypted at Rest</span>
              <span className={styles.trustItem}><i className="fa-solid fa-server" /> Self-Hostable</span>
            </div>

            <p className={styles.footer}>
              Already have an account?
              <Link href="/login" className={styles.footerLink}>Sign in instead</Link>
            </p>
          </>
        )}

        {phase === "onboarding" && (
          <div className={styles.onboarding}>
            <div className={styles.onboardHeader}>
              <div className={styles.onboardCheck}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className={styles.onboardTitle}>Welcome, {displayName.split(" ")[0] || "researcher"}!</h1>
              <p className={styles.onboardSub}>Account created — let&apos;s tailor MoleCraft to you.</p>
            </div>

            <div className={styles.onboardProgress}>
              {ONBOARD_QUESTIONS.map((q, i) => (
                <span
                  key={q.key}
                  className={`${styles.onboardBar} ${i <= onboardStep ? styles.onboardBarActive : ""}`}
                />
              ))}
              <span className={styles.onboardCount}>{onboardStep + 1} of {ONBOARD_QUESTIONS.length}</span>
            </div>

            <div
              key={onboardStep}
              className={`${styles.onboardCard} ${onboardLeaving ? styles.onboardCardOut : styles.onboardCardIn}`}
            >
              <h2 className={styles.onboardQuestion}>{question.title}</h2>
              <div className={styles.optionGrid}>
                {question.options.map((opt, i) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={styles.optionChip}
                    style={{ animationDelay: `${80 + i * 45}ms` }}
                    onClick={() => answerQuestion(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.onboardSkip} onClick={skipQuestion}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className={styles.onboarding}>
            <div className={styles.onboardDone}>
              <div className={styles.onboardDoneRing}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className={styles.onboardTitle}>You&apos;re all set!</h1>
              <p className={styles.onboardSub}>Taking you to your workspace...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}