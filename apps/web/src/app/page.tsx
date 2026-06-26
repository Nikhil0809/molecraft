"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import styles from "./page.module.css";

export default function LandingPage() {
  const { login, signup } = useAuth();
  const [view, setView] = useState<"landing" | "auth">("landing");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const [authName, setAuthName] = useState("");
  const [authOrg, setAuthOrg] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const ambientRef = useRef<HTMLCanvasElement>(null);
  const moleculeRef = useRef<HTMLCanvasElement>(null);

  const showView = (v: "landing" | "auth", mode = "signin") => {
    setView(v);
    setAuthError(null);
    if (v === "auth") setAuthMode(mode as "signin" | "signup");
    window.scrollTo(0, 0);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (authMode === "signin") {
      if (!authEmail || !authPassword) {
        setAuthError("Please fill in all fields.");
        return;
      }
      setAuthSubmitting(true);
      try {
        await login(authEmail, authPassword);
      } catch (err: unknown) {
        setAuthError(err instanceof Error ? err.message : "Login failed.");
      } finally {
        setAuthSubmitting(false);
      }
    } else {
      if (!authName || !authOrg || !authEmail || !authPassword) {
        setAuthError("Please fill in all fields.");
        return;
      }
      setAuthSubmitting(true);
      try {
        await signup(authEmail, authPassword, authName, "Researcher", authOrg);
      } catch (err: unknown) {
        setAuthError(err instanceof Error ? err.message : "Signup failed.");
      } finally {
        setAuthSubmitting(false);
      }
    }
  };

  useEffect(() => {
    const ambient = ambientRef.current;
    const molecule = moleculeRef.current;
    if (!ambient || !molecule) return;

    const aCtx = ambient.getContext("2d");
    const mCtx = molecule.getContext("2d");
    if (!aCtx || !mCtx) return;

    let aW = ambient.width = window.innerWidth;
    let aH = ambient.height = window.innerHeight;

    const resize = () => {
      aW = ambient.width = window.innerWidth;
      aH = ambient.height = window.innerHeight;
      if (molecule.offsetWidth > 0) {
        molecule.width = molecule.offsetWidth;
        molecule.height = molecule.offsetHeight;
      }
    };
    window.addEventListener("resize", resize);

    const dots = Array.from({ length: 25 }, () => ({
      x: Math.random() * aW, y: Math.random() * aH,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      radius: Math.random() * 2 + 1, alpha: Math.random() * 0.2 + 0.05,
    }));

    let mW = molecule.offsetWidth || 350;
    let mH = molecule.offsetHeight || 350;
    molecule.width = mW; molecule.height = mH;

    const nodes = Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2;
      const dist = 60 + Math.random() * 40;
      return {
        baseX: mW / 2 + Math.cos(angle) * dist,
        baseY: mH / 2 + Math.sin(angle) * dist,
        x: 0, y: 0, radius: Math.random() * 4 + 4,
        color: i % 2 === 0 ? "#7C3AED" : "#06B6D4",
      };
    });

    let pulseTime = 0;
    let animId: number;

    const loop = () => {
      aCtx.clearRect(0, 0, aW, aH);
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > aW) d.vx *= -1;
        if (d.y < 0 || d.y > aH) d.vy *= -1;
        aCtx.beginPath();
        aCtx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        aCtx.fillStyle = `rgba(124, 58, 237, ${d.alpha})`;
        aCtx.fill();
      }

      if (view === "landing" && molecule.offsetWidth > 0) {
        if (molecule.width !== molecule.offsetWidth || molecule.height !== molecule.offsetHeight) {
          mW = molecule.width = molecule.offsetWidth;
          mH = molecule.height = molecule.offsetHeight;
        }
        mCtx.clearRect(0, 0, mW, mH);
        pulseTime += 0.015;

        mCtx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        mCtx.lineWidth = 1.5;
        for (let i = 0; i < nodes.length; i++) {
          nodes[i].x = nodes[i].baseX + Math.sin(pulseTime + i) * 6;
          nodes[i].y = nodes[i].baseY + Math.cos(pulseTime * 0.6 + i) * 6;
          for (let j = i + 1; j < nodes.length; j++) {
            if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < 130) {
              mCtx.beginPath();
              mCtx.moveTo(nodes[i].x, nodes[i].y);
              mCtx.lineTo(nodes[j].x, nodes[j].y);
              mCtx.stroke();
            }
          }
        }
        for (const n of nodes) {
          mCtx.beginPath();
          mCtx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          mCtx.fillStyle = n.color;
          mCtx.fill();
        }
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [view]);

  return (
    <div className={styles.page}>
      <div className={styles.ambientGlow1} />
      <div className={styles.ambientGlow2} />

      <canvas ref={ambientRef} className={styles.ambientCanvas} />

      <div className={styles.navbar}>
        <header className={styles.navInner}>
          <a className={styles.navLogo} onClick={() => showView("landing")}>
            <img src="/logo.png" alt="MoleCraft Logo" className={styles.navLogoImg} />
            <span className={styles.navLogoText}>MoleCraft</span>
          </a>

          <nav className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Platform</a>
            <a href="#pipeline" className={styles.navLink}>Pipelines</a>
            <a href="#comparison" className={styles.navLink}>Matrix</a>
            <a href="https://github.com" target="_blank" className={styles.navLink}>Docs</a>
          </nav>

          <div className={styles.navActions}>
            <Link href="/login" className={styles.navSignIn}>Sign In</Link>
            <Link href="/signup" className={styles.navGetStarted}>Get Started</Link>
          </div>
        </header>
      </div>

      {view === "landing" && (
        <main id="main-landing-view" className={styles.landingView}>
          <section className={styles.hero}>
            <div className={styles.heroGrid}>
              <div className={styles.heroContent}>
                <div className={styles.heroBadge}>
                  <span className={styles.heroBadgeDot} />
                  MIT Open Source Platform
                </div>
                <h1 className={styles.heroTitle}>
                  AI-Powered <br /><span className={styles.heroTitleGradient}>Drug Discovery</span>
                </h1>
                <p className={styles.heroDesc}>
                  The ultimate cloud-native engine integrating generative chemistry, multi-omics target verification, predictive toxicology, and real-time laboratory workflows without boundaries.
                </p>
                <div className={styles.heroActions}>
                  <Link href="/signup" className={styles.heroBtnPrimary}>Launch Secure Platform</Link>
                  <a href="#features" className={styles.heroBtnSecondary}>
                    Explore Modules <i className="fa-regular fa-arrow-down-long" />
                  </a>
                </div>
              </div>

              <div className={styles.heroVisual}>
                <canvas ref={moleculeRef} className={styles.moleculeCanvas} />
                <div className={styles.heroCard1}>
                  <p className={styles.heroCardLabel}>Binding Affinity</p>
                  <p className={styles.heroCardValue}>-14.2 kcal/mol</p>
                </div>
                <div className={styles.heroCard2}>
                  <p className={styles.heroCardLabel}>ADMET Filter</p>
                  <p className={styles.heroCardValueCyan}>99.2% Profile Pass</p>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.statsBar}>
            <div className={styles.statsInner}>
              <div><p className={styles.statValue}>17+</p><p className={styles.statLabel}>Core AI Engines</p></div>
              <div><p className={styles.statValue}>140+</p><p className={styles.statLabel}>Transformers</p></div>
              <div><p className={styles.statValue}>&lt; 4.2h</p><p className={styles.statLabel}>In-Silico Processing</p></div>
              <div><p className={styles.statValue}>MIT</p><p className={styles.statLabel}>Open License</p></div>
            </div>
          </section>

          <section className={styles.section} id="features">
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTag}>Deep Infrastructure</p>
              <h2 className={styles.sectionTitle}>Modular Architecture</h2>
            </div>
            <div className={styles.featureGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}><i className="fa-regular fa-brain" /></div>
                <h3 className={styles.featureTitle}>OmniMole Foundation Model</h3>
                <p className={styles.featureDesc}>A 12B parameter multimodal model trained comprehensively on architectural configuration setups and biological sequences.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#7C3AED" }}><i className="fa-regular fa-atom" /></div>
                <h3 className={styles.featureTitle}>AI Molecule Generator</h3>
                <p className={styles.featureDesc}>Generate targeted molecular structural frameworks optimized natively against structural pocket properties.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#3B82F6" }}><i className="fa-regular fa-chart-scatter" /></div>
                <h3 className={styles.featureTitle}>Docking Affinity Module</h3>
                <p className={styles.featureDesc}>Simulate dynamic structural orientation parameters and complex binding parameters in parallel arrays.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#34D399" }}><i className="fa-regular fa-shield-virus" /></div>
                <h3 className={styles.featureTitle}>ADMET Toxicity Matrix</h3>
                <p className={styles.featureDesc}>Map comprehensive clearance benchmarks, bio-availability performance arrays, and metabolic paths safely.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#A78BFA" }}><i className="fa-regular fa-dna" /></div>
                <h3 className={styles.featureTitle}>Protein &amp; RNA Synthesis</h3>
                <p className={styles.featureDesc}>Algorithmic configuration designs for advanced therapeutic antibodies and specialized PROTAC frameworks.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#06B6D4" }}><i className="fa-regular fa-robot" /></div>
                <h3 className={styles.featureTitle}>Autonomous Lab Automation</h3>
                <p className={styles.featureDesc}>Direct synthesis compilation script outputs readable by programmatic remote execution labs.</p>
              </div>
            </div>
          </section>

          <section className={styles.sectionBordered} id="pipeline">
            <div className={styles.sectionHeaderCenter}>
              <p className={styles.sectionTag}>Operational Flow</p>
              <h2 className={styles.sectionTitle}>Discovery Continuum</h2>
            </div>
            <div className={styles.pipelineList}>
              <div className={styles.pipelineItem}>
                <div className={styles.pipelinePhase} style={{ color: "#06B6D4" }}>Phase 01</div>
                <div className={styles.pipelineContent}>
                  <h4 className={styles.pipelineTitle}>Target Identification &amp; Resolution</h4>
                  <p className={styles.pipelineDesc}>Bulk extraction and classification of dynamic causal mutations through deep multi-graph networks.</p>
                </div>
              </div>
              <div className={styles.pipelineItem}>
                <div className={styles.pipelinePhase} style={{ color: "#7C3AED" }}>Phase 02</div>
                <div className={styles.pipelineContent}>
                  <h4 className={styles.pipelineTitle}>Generative Structural Synthesis</h4>
                  <p className={styles.pipelineDesc}>Millions of de novo compounds generated, evaluated, and ranked concurrently for designated active sites.</p>
                </div>
              </div>
              <div className={styles.pipelineItem}>
                <div className={styles.pipelinePhase} style={{ color: "#3B82F6" }}>Phase 03</div>
                <div className={styles.pipelineContent}>
                  <h4 className={styles.pipelineTitle}>In-Silico Safety Matrix Screening</h4>
                  <p className={styles.pipelineDesc}>Advanced safety profiling filtering out non-viable molecules using chemical graph analysis pipelines.</p>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.sectionBordered} id="comparison">
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTagCyan}>Comparative Benchmarks</p>
              <h2 className={styles.sectionTitle}>Capabilities Matrix</h2>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHeadRow}>
                    <th className={styles.tableHead}>Capability Core</th>
                    <th className={`${styles.tableHead} ${styles.tableHeadHighlight}`}>MoleCraft</th>
                    <th className={styles.tableHead}>Legacy Environments</th>
                    <th className={styles.tableHead}>Alternative Suites</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCellBold}>Licensing Structure</td>
                    <td className={styles.tableCellHighlight}>Open Source (MIT)</td>
                    <td className={styles.tableCell}>Seat-Based License</td>
                    <td className={styles.tableCell}>Closed Catalog</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCellBold}>De Novo Architecture</td>
                    <td className={styles.tableCellCheck}><i className="fa-regular fa-check" /> Native</td>
                    <td className={styles.tableCell}>Module Add-on</td>
                    <td className={styles.tableCell}>Cloud Only</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCellBold}>On-Prem Deployment</td>
                    <td className={styles.tableCellCheck}><i className="fa-regular fa-check" /> Supported</td>
                    <td className={styles.tableCell}>Unavailable</td>
                    <td className={styles.tableCell}>Restricted</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCellBold}>Programmatic Lab Sync</td>
                    <td className={styles.tableCellCheck}><i className="fa-regular fa-check" /> Unified API</td>
                    <td className={styles.tableCell}>No Integration</td>
                    <td className={styles.tableCellCheck}><i className="fa-regular fa-check" /> Internal APIs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.ctaSection}>
            <h2 className={styles.ctaTitle}>Accelerate Molecular Design</h2>
            <p className={styles.ctaDesc}>Deploy individual models locally or coordinate high-throughput operations instantly via unified enterprise arrays.</p>
            <div className={styles.ctaActions}>
              <Link href="/signup" className={styles.heroBtnPrimary}>Initialize Instance</Link>
              <a href="https://github.com" target="_blank" className={styles.ctaLink}>Explore Repository</a>
            </div>
          </section>
        </main>
      )}

      {view === "auth" && (
        <main className={styles.authView}>
          <div className={styles.authContainer}>
            <div className={styles.branding}>
              <div className={styles.logoWrapper}>
                <img src="/logo.png" alt="MoleCraft Logo" className={styles.logo} />
                <h1 className={styles.authTitle}>{authMode === "signin" ? "Welcome Back" : "Create Profile"}</h1>
              </div>
              <p className={styles.tagline}>
                {authMode === "signin"
                  ? "Sign in to continue your AI drug discovery workflow"
                  : "Gain automated platform orchestration permissions instantly"}
              </p>
            </div>

            <div className={styles.authTabs}>
              <button
                className={`${styles.authTab} ${authMode === "signin" ? styles.authTabActive : ""}`}
                onClick={() => { setAuthMode("signin"); setAuthError(null); }}
              >Sign In</button>
              <button
                className={`${styles.authTab} ${authMode === "signup" ? styles.authTabActive : ""}`}
                onClick={() => { setAuthMode("signup"); setAuthError(null); }}
              >Create Account</button>
            </div>

            {authError && (
              <div className={styles.authError}>
                <i className="fa-regular fa-circle-exclamation" />
                <span>{authError}</span>
              </div>
            )}

            <form className={styles.authForm} onSubmit={handleAuthSubmit}>
              {authMode === "signup" && (
                <>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Full Profile Name</label>
                    <div className={styles.inputWrapper}>
                      <div className={styles.inputIcon}><i className="fa-regular fa-user" /></div>
                      <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Dr. Evelyn Harper" className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Organization / Lab</label>
                    <div className={styles.inputWrapper}>
                      <div className={styles.inputIcon}><i className="fa-regular fa-building-columns" /></div>
                      <input type="text" value={authOrg} onChange={(e) => setAuthOrg(e.target.value)} placeholder="Stanford BioML Group" className={styles.input} />
                    </div>
                  </div>
                </>
              )}

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Institutional Email</label>
                <div className={styles.inputWrapper}>
                  <div className={styles.inputIcon}><i className="fa-regular fa-envelope" /></div>
                  <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="evelyn.harper@stanford.edu" className={styles.input} required />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <div className={styles.inputLabelRow}>
                  <label className={styles.inputLabel}>Secure Access Key</label>
                  {authMode === "signin" && <a href="#" className={styles.forgotLink} onClick={(e) => { e.preventDefault(); alert("Password reset routing is integrated via institutional SMTP relays."); }}>Forgot key?</a>}
                </div>
                <div className={styles.inputWrapper}>
                  <div className={styles.inputIcon}><i className="fa-regular fa-lock" /></div>
                  <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••••••" className={styles.input} required />
                </div>
              </div>

              {authMode === "signin" && (
                <div className={styles.rememberRow}>
                  <label className={styles.rememberLabel}>
                    <input type="checkbox" className={styles.rememberCheckbox} />
                    <span>Remember this computing node</span>
                  </label>
                </div>
              )}

              <button type="submit" className={styles.authSubmit} disabled={authSubmitting}>
                {authSubmitting ? "Processing..." : authMode === "signin" ? "Access Secure Vault" : "Register Infrastructure Node"}
              </button>

              <div className={styles.authDivider}>
                <div className={styles.authDividerLine} />
                <span className={styles.authDividerText}>Or continue with identity protocols</span>
              </div>

              <div className={styles.socialGrid}>
                <button type="button" className={styles.socialBtn} onClick={() => alert("Google Identity Provider Handshake initiated.")}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google
                </button>
                <button type="button" className={`${styles.socialBtn} ${styles.socialGithub}`} onClick={() => alert("GitHub Integration Identity Protocol initiated.")}>
                  <i className="fa-brands fa-github" /> GitHub
                </button>
              </div>
            </form>
          </div>
        </main>
      )}

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <a className={styles.footerLogo} onClick={() => showView("landing")}>
              <img src="/logo.png" alt="MoleCraft Logo" className={styles.footerLogoImg} />
              <span className={styles.footerLogoText}>MoleCraft</span>
            </a>
            <p className={styles.footerDesc}>Advanced sovereign model structures engineering future drug arrays safely under structural open automation pipelines.</p>
          </div>
          <div className={styles.footerCol}>
            <h5 className={styles.footerColTitle}>Platform</h5>
            <ul className={styles.footerLinks}>
              <li><a href="#features" className={styles.footerLink}>OmniMole Foundation</a></li>
              <li><a href="#features" className={styles.footerLink}>Synthesis Core</a></li>
              <li><a href="#pipeline" className={styles.footerLink}>Automated Pipelines</a></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h5 className={styles.footerColTitle}>Resources</h5>
            <ul className={styles.footerLinks}>
              <li><a href="https://github.com" target="_blank" className={styles.footerLink}>GitHub Source</a></li>
              <li><a href="#" className={styles.footerLink}>BioML Standards</a></li>
              <li><a href="#" className={styles.footerLink}>Academic Documentation</a></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h5 className={styles.footerColTitle}>Security</h5>
            <ul className={styles.footerLinks}>
              <li><a href="#" className={styles.footerLink}>Isolation Matrices</a></li>
              <li><a href="#" className={styles.footerLink}>Compliance Rules</a></li>
            </ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>&copy; 2026 MoleCraft Systems Inc. Provided openly via standard MIT protocol distribution parameters.</span>
          <span className={styles.footerBadge}>Secure Cryptographic Operations Only</span>
        </div>
      </footer>
    </div>
  );
}
