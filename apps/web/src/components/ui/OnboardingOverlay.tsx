"use client";

import { useState } from "react";
import styles from "./OnboardingOverlay.module.css";

const STEPS = [
  {
    title: "RAG-Augmented Search",
    description:
      "MoleCraft queries multiple scientific databases (PubMed, ChEMBL, PubChem, UniProt) simultaneously. Watch the status strip to see which sources are being searched in real time — no hidden spinners.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="16" stroke="var(--accent-primary)" strokeWidth="1.5" strokeDasharray="4 3"/>
        <circle cx="12" cy="14" r="3" fill="var(--accent-primary)" fillOpacity="0.3" stroke="var(--accent-primary)" strokeWidth="1"/>
        <circle cx="28" cy="14" r="3" fill="var(--accent-success)" fillOpacity="0.3" stroke="var(--accent-success)" strokeWidth="1"/>
        <circle cx="20" cy="28" r="3" fill="var(--accent-warning)" fillOpacity="0.3" stroke="var(--accent-warning)" strokeWidth="1"/>
        <path d="M14 16L18 24M26 16L22 24" stroke="var(--text-muted)" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    title: "Source Credibility Tiers",
    description:
      "Citations are organized by credibility. Tier 1 (peer-reviewed journals), Tier 2 (preprints — clearly flagged), and Tier 3 (web — supplementary context only, not for citation). You'll always know what to trust.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="8" y="8" width="24" height="8" rx="2" fill="var(--tier1-bg)" stroke="var(--tier1-border)" strokeWidth="1"/>
        <rect x="8" y="18" width="24" height="6" rx="2" fill="var(--tier2-bg)" stroke="var(--tier2-border)" strokeWidth="1"/>
        <rect x="8" y="26" width="24" height="6" rx="2" fill="var(--tier3-bg)" stroke="var(--tier3-border)" strokeWidth="1"/>
        <text x="14" y="14" fill="var(--tier1-text)" fontSize="7" fontWeight="600">T1</text>
        <text x="14" y="23" fill="var(--tier2-text)" fontSize="7" fontWeight="600">T2</text>
        <text x="14" y="31" fill="var(--tier3-text)" fontSize="7" fontWeight="600">T3</text>
      </svg>
    ),
  },
  {
    title: "Binding Affinity & Confidence",
    description:
      "Predicted binding affinity is shown in nanomolar (nM) with a 95% confidence interval. The validation method (scaffold-validated vs random-split) is always visible — never hidden. Lower nM values indicate stronger binding.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <text x="8" y="22" fill="var(--accent-primary)" fontSize="16" fontWeight="600" fontFamily="var(--font-display)">7.4</text>
        <text x="30" y="22" fill="var(--text-secondary)" fontSize="8" fontFamily="var(--font-display)">nM</text>
        <text x="8" y="32" fill="var(--text-muted)" fontSize="8" fontFamily="var(--font-display)">[6.9 – 7.9]</text>
      </svg>
    ),
  },
];

export function OnboardingOverlay() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("molecraft-onboarding-dismissed");
  });
  const [step, setStep] = useState(0);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem("molecraft-onboarding-dismissed", "true");
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const currentStep = STEPS[step];

  return (
    <div className={styles.overlay} onClick={dismiss}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Welcome to MoleCraft"
      >
        <button className={styles.closeButton} onClick={dismiss} aria-label="Dismiss onboarding">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        <div className={styles.iconArea}>{currentStep.icon}</div>

        <h2 className={styles.title}>{currentStep.title}</h2>
        <p className={styles.description}>{currentStep.description}</p>

        <div className={styles.footer}>
          <div className={styles.dots}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === step ? styles.activeDot : ""}`}
              />
            ))}
          </div>
          <div className={styles.actions}>
            <button className={styles.skipButton} onClick={dismiss}>
              Skip
            </button>
            <button className={styles.nextButton} onClick={next}>
              {step === STEPS.length - 1 ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
