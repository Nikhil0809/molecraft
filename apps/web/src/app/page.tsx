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
            <a href="#features" className={styles.navLink}>Modules</a>
            <a href="#implementation" className={styles.navLink}>Tech Stack</a>
            <a href="#registry" className={styles.navLink}>Registry</a>
            <a href="#pipeline" className={styles.navLink}>Continuum</a>
            <a href="#comparison" className={styles.navLink}>Capabilities</a>
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
                  MIT Licensed Open-Source Platform
                </div>
                <h1 className={styles.heroTitle}>
                  Autonomous AI <br /><span className={styles.heroTitleGradient}>Drug Discovery</span>
                </h1>
                <p className={styles.heroDesc}>
                  A state-of-the-art sovereign engine orchestrating 18+ containerized machine learning microservices, generative chemistry, multi-omics target verification, and programmatic laboratory sync.
                </p>
                <div className={styles.heroActions}>
                  <Link href="/signup" className={styles.heroBtnPrimary}>Initialize Workspace</Link>
                  <a href="#implementation" className={styles.heroBtnSecondary}>
                    Explore Implementation <i className="fa-solid fa-arrow-down" />
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
              <div>
                <i className="fa-solid fa-cubes" style={{ color: "#7C3AED", fontSize: "18px", marginBottom: "8px", display: "inline-block" }} />
                <p className={styles.statValue}>18+</p>
                <p className={styles.statLabel}>Active Microservices</p>
              </div>
              <div>
                <i className="fa-solid fa-network-wired" style={{ color: "#3B82F6", fontSize: "18px", marginBottom: "8px", display: "inline-block" }} />
                <p className={styles.statValue}>25+</p>
                <p className={styles.statLabel}>Integrated Routes</p>
              </div>
              <div>
                <i className="fa-solid fa-brain" style={{ color: "#06B6D4", fontSize: "18px", marginBottom: "8px", display: "inline-block" }} />
                <p className={styles.statValue}>12B+</p>
                <p className={styles.statLabel}>Model Parameters</p>
              </div>
              <div>
                <i className="fa-solid fa-shield-halved" style={{ color: "#34D399", fontSize: "18px", marginBottom: "8px", display: "inline-block" }} />
                <p className={styles.statValue}>100%</p>
                <p className={styles.statLabel}>Sovereign Deployments</p>
              </div>
            </div>
          </section>

          <section className={styles.section} id="features">
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTag}>Platform Capabilities</p>
              <h2 className={styles.sectionTitle}>Modular Architecture</h2>
            </div>
            <div className={styles.featureGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#7C3AED" }}><i className="fa-solid fa-flask-vial" /></div>
                <h3 className={styles.featureTitle}>Generative Chemistry Suite</h3>
                <p className={styles.featureDesc}>Generate targeted molecular structural frameworks optimized against specific structural pocket properties using 3D-aware diffusion and reinforcement learning models.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#3B82F6" }}><i className="fa-solid fa-puzzle-piece" /></div>
                <h3 className={styles.featureTitle}>Structure-Based Docking</h3>
                <p className={styles.featureDesc}>Simulate dynamic binding poses, orientations, and binding pocket affinity parameters using integrated AutoDock Vina, DiffDock, and GNINA architectures.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#A78BFA" }}><i className="fa-solid fa-helix" /></div>
                <h3 className={styles.featureTitle}>RNA Therapeutics Design</h3>
                <p className={styles.featureDesc}>Algorithmic optimization designs targeting seed regions, gapmer setups, and codon modifications to engineer stable siRNA, ASO, and mRNA candidates.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#34D399" }}><i className="fa-solid fa-shield-halved" /></div>
                <h3 className={styles.featureTitle}>ADMET Toxicity Profiling</h3>
                <p className={styles.featureDesc}>Map comprehensive absorption, distribution, metabolism, excretion, and toxicity profiles to filter out non-viable chemical structures before in-vitro synthesis.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#06B6D4" }}><i className="fa-solid fa-circle-nodes" /></div>
                <h3 className={styles.featureTitle}>Peptide &amp; Macrocycle Core</h3>
                <p className={styles.featureDesc}>Perform advanced designs for macrocycles and linear peptides with structural predictions for helical content, amphipathicity, and oral bioavailability.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#3B82F6" }}><i className="fa-solid fa-robot" /></div>
                <h3 className={styles.featureTitle}>Autonomous Lab Automation</h3>
                <p className={styles.featureDesc}>Generate validated protocol scripts compatible with Opentrons, Tecan, and standard liquid handling devices to synchronize digital designs with physical automation.</p>
              </div>
            </div>
          </section>

          <section className={styles.sectionBordered} id="implementation">
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTag}>Implemented Architecture</p>
              <h2 className={styles.sectionTitle}>What's Implemented in this Project</h2>
            </div>
            <div className={styles.featureGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#3B82F6" }}><i className="fa-solid fa-layer-group" /></div>
                <h3 className={styles.featureTitle}>Next.js 16 Web Dashboard</h3>
                <p className={styles.featureDesc}>Fully functional React 19 interface. Covers 25+ app pages including workspace viewer, generation logs, clinical trials, and lab integrations.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#7C3AED" }}><i className="fa-solid fa-server" /></div>
                <h3 className={styles.featureTitle}>FastAPI API Gateway</h3>
                <p className={styles.featureDesc}>Serving as the unified API orchestrator. Dynamically mounts, proxies, and routes incoming HTTP traffic to respective model engines and database nodes.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#06B6D4" }}><i className="fa-solid fa-cubes" /></div>
                <h3 className={styles.featureTitle}>18+ Python Microservices</h3>
                <p className={styles.featureDesc}>Docker-compose environment running individual models like GNN property predictions, ESMFold protein structures, and ADMET toxicity pipelines.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#34D399" }}><i className="fa-solid fa-magnifying-glass-plus" /></div>
                <h3 className={styles.featureTitle}>Multi-Source RAG Pipeline</h3>
                <p className={styles.featureDesc}>Semantic index and retriever querying databases like PubMed, ChEMBL, and patents. Powered by ChromaDB vector store and Groq/OpenAI inference.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#A78BFA" }}><i className="fa-solid fa-brain" /></div>
                <h3 className={styles.featureTitle}>Active AI Model Layer</h3>
                <p className={styles.featureDesc}>Local interface scripts mapping GNN chemical models, ESM protein embeddings, MolT5 translator, and AutoDock Vina simulation parameters.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#6B7280" }}><i className="fa-solid fa-clipboard-check" /></div>
                <h3 className={styles.featureTitle}>Unified Dev Setup &amp; Tests</h3>
                <p className={styles.featureDesc}>Fully configures environment schemas, local database migrations, standard python pytest files, and Next.js frontend Jest test coverages.</p>
              </div>
            </div>
          </section>

          <section className={styles.sectionBordered} id="registry">
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTag}>Docker Microservices Registry</p>
              <h2 className={styles.sectionTitle}>18 Decoupled Services Orchestrated via Unified Gateway</h2>
            </div>
            <div className={styles.featureGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#3B82F6" }}><i className="fa-solid fa-network-wired" /></div>
                <h3 className={styles.featureTitle}>API Gateway <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8000</span></h3>
                <p className={styles.featureDesc}>Unified ASGI entry point routing client requests, executing request schemas, and handling token authentication proxying.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#7C3AED" }}><i className="fa-solid fa-dna" /></div>
                <h3 className={styles.featureTitle}>Foundation Models <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8005</span></h3>
                <p className={styles.featureDesc}>GPU-accelerated endpoint running ESMFold protein structure predictors, MolT5 chemical translators, and GNN property networks.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#06B6D4" }}><i className="fa-solid fa-wand-magic-sparkles" /></div>
                <h3 className={styles.featureTitle}>Generative Diffusion <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8008</span></h3>
                <p className={styles.featureDesc}>Generates 3D-aware de-novo small molecules using equivariant diffusion models conditioned on protein pocket targets.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#34D399" }}><i className="fa-solid fa-magnifying-glass-plus" /></div>
                <h3 className={styles.featureTitle}>RAG &amp; Search Pipeline <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8002</span></h3>
                <p className={styles.featureDesc}>Multi-tier semantic search engine querying PubMed literature, ChEMBL database, and USPTO patent files using Groq LLM reasoning.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#A78BFA" }}><i className="fa-solid fa-puzzle-piece" /></div>
                <h3 className={styles.featureTitle}>Molecular Docking Core <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8003</span></h3>
                <p className={styles.featureDesc}>Computes structural ligand binding configurations and calculates affinity values using AutoDock Vina, GNINA, and DiffDock.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#6B7280" }}><i className="fa-solid fa-shield-heart" /></div>
                <h3 className={styles.featureTitle}>ADMET Property Predictor <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8006</span></h3>
                <p className={styles.featureDesc}>In-silico toxicology screening predicting absorption, distribution, metabolism, excretion, and mutagenicity profiles from SMILES strings.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#3B82F6" }}><i className="fa-solid fa-helix" /></div>
                <h3 className={styles.featureTitle}>RNA Design Suite <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8022</span></h3>
                <p className={styles.featureDesc}>Designs therapeutic RNA oligonucleotides, focusing on seed region target match, gapmer sequence designs, and mRNA stability.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#7C3AED" }}><i className="fa-solid fa-circle-nodes" /></div>
                <h3 className={styles.featureTitle}>Peptide Engineering <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8023</span></h3>
                <p className={styles.featureDesc}>Calculates secondary structure properties, helical ratios, and stapling configurations for linear and macrocyclic peptide agents.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#06B6D4" }}><i className="fa-solid fa-shield-virus" /></div>
                <h3 className={styles.featureTitle}>Antibody Designer <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8020</span></h3>
                <p className={styles.featureDesc}>Models light and heavy chain sequence pairings, binding affinity variables, and variable region compatibility patterns.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#34D399" }}><i className="fa-solid fa-compress" /></div>
                <h3 className={styles.featureTitle}>PROTAC Design Engine <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8021</span></h3>
                <p className={styles.featureDesc}>Models ternary complexes, linker structural alignments, and target-ligase binding affinities to engineer active protein degraders.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#A78BFA" }}><i className="fa-solid fa-chart-line" /></div>
                <h3 className={styles.featureTitle}>Clinical Trials Oracle <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8030</span></h3>
                <p className={styles.featureDesc}>Evaluates clinical trial protocol designs to predict success probabilities, hazard ratios, and phase transition risks.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#6B7280" }}><i className="fa-solid fa-gauge-high" /></div>
                <h3 className={styles.featureTitle}>Physics Sim &amp; MD <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8050</span></h3>
                <p className={styles.featureDesc}>Configures and runs molecular dynamics simulations, energy minimizations, and thermodynamic binding pathway calculations.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#3B82F6" }}><i className="fa-solid fa-microscope" /></div>
                <h3 className={styles.featureTitle}>Lab Automation API <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8040</span></h3>
                <p className={styles.featureDesc}>Compiles digital molecule designs into programmatic liquid handler command scripts targeting Opentrons and Tecan instruments.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#7C3AED" }}><i className="fa-solid fa-table-cells" /></div>
                <h3 className={styles.featureTitle}>Proteochemometrics <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8004</span></h3>
                <p className={styles.featureDesc}>Computes compound-target interaction matrices using deep networks to model cross-reactivity and off-target risks.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#06B6D4" }}><i className="fa-solid fa-comments" /></div>
                <h3 className={styles.featureTitle}>Molecule Q&amp;A Chat <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8007</span></h3>
                <p className={styles.featureDesc}>An intelligent chat agent answering structural, biochemical, and literature queries about user-submitted molecules.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#34D399" }}><i className="fa-solid fa-scale-balanced" /></div>
                <h3 className={styles.featureTitle}>Patent &amp; IP Analyzer <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8060</span></h3>
                <p className={styles.featureDesc}>Mines and extracts chemical structure descriptions and therapeutic target claims from USPTO and WIPO patent filings.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#A78BFA" }}><i className="fa-solid fa-barcode" /></div>
                <h3 className={styles.featureTitle}>Omics Target Finder <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8010</span></h3>
                <p className={styles.featureDesc}>Identifies differential gene expressions and biological pathway correlations to validate target relevance in diseased tissues.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon} style={{ color: "#6B7280" }}><i className="fa-solid fa-database" /></div>
                <h3 className={styles.featureTitle}>Ingestion &amp; Vector DB <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>Port 8011</span></h3>
                <p className={styles.featureDesc}>Manages local context indexing using ChromaDB to enable document retrieval and semantic searches across scientific papers.</p>
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
                <div className={styles.pipelinePhase} style={{ color: "#06B6D4" }}>
                  <i className="fa-solid fa-magnifying-glass-chart" style={{ marginRight: "8px" }} /> Phase 01
                </div>
                <div className={styles.pipelineContent}>
                  <h4 className={styles.pipelineTitle}>Literature Synthesis &amp; Multi-Omics RAG</h4>
                  <p className={styles.pipelineDesc}>Bulk retrieval of clinical trial records, patent logs, and biological literature context coupled with local mutation analysis to isolate high-value disease targets.</p>
                </div>
              </div>
              <div className={styles.pipelineItem}>
                <div className={styles.pipelinePhase} style={{ color: "#7C3AED" }}>
                  <i className="fa-solid fa-flask" style={{ marginRight: "8px" }} /> Phase 02
                </div>
                <div className={styles.pipelineContent}>
                  <h4 className={styles.pipelineTitle}>Generative Structure Optimization</h4>
                  <p className={styles.pipelineDesc}>Coordinate generative diffusion algorithms and scaffold-hopping parameters to generate millions of de novo therapeutic candidates targeting designated active pocket sites.</p>
                </div>
              </div>
              <div className={styles.pipelineItem}>
                <div className={styles.pipelinePhase} style={{ color: "#3B82F6" }}>
                  <i className="fa-solid fa-shield-halved" style={{ marginRight: "8px" }} /> Phase 03
                </div>
                <div className={styles.pipelineContent}>
                  <h4 className={styles.pipelineTitle}>In-Silico Docking &amp; ADMET Profiling</h4>
                  <p className={styles.pipelineDesc}>Run AutoDock Vina pose prediction, evaluate toxicity properties (ADMET) via machine learning, and construct execution script arrays for liquid-handling synthesis.</p>
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
                    <td className={styles.tableCellCheck}><i className="fa-solid fa-circle-check" /> Native</td>
                    <td className={styles.tableCell}>Module Add-on</td>
                    <td className={styles.tableCell}>Cloud Only</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCellBold}>On-Prem Deployment</td>
                    <td className={styles.tableCellCheck}><i className="fa-solid fa-circle-check" /> Supported</td>
                    <td className={styles.tableCell}>Unavailable</td>
                    <td className={styles.tableCell}>Restricted</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCellBold}>Programmatic Lab Sync</td>
                    <td className={styles.tableCellCheck}><i className="fa-solid fa-circle-check" /> Unified API</td>
                    <td className={styles.tableCell}>No Integration</td>
                    <td className={styles.tableCellCheck}><i className="fa-solid fa-circle-check" /> Internal APIs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.ctaSection}>
            <h2 className={styles.ctaTitle}>Accelerate Molecular Design</h2>
            <p className={styles.ctaDesc}>Deploy sovereign foundation models locally or orchestrate automated high-throughput workflows via unified docker configurations.</p>
            <div className={styles.ctaActions}>
              <Link href="/signup" className={styles.heroBtnPrimary}>Initialize Dev Cluster</Link>
              <a href="https://github.com" target="_blank" className={styles.ctaLink}>View GitHub Repo</a>
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
                <i className="fa-solid fa-circle-exclamation" />
                <span>{authError}</span>
              </div>
            )}

            <form className={styles.authForm} onSubmit={handleAuthSubmit}>
              {authMode === "signup" && (
                <>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Full Profile Name</label>
                    <div className={styles.inputWrapper}>
                      <div className={styles.inputIcon}><i className="fa-solid fa-user" /></div>
                      <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Dr. Evelyn Harper" className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Organization / Lab</label>
                    <div className={styles.inputWrapper}>
                      <div className={styles.inputIcon}><i className="fa-solid fa-building-columns" /></div>
                      <input type="text" value={authOrg} onChange={(e) => setAuthOrg(e.target.value)} placeholder="Stanford BioML Group" className={styles.input} />
                    </div>
                  </div>
                </>
              )}

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Institutional Email</label>
                <div className={styles.inputWrapper}>
                  <div className={styles.inputIcon}><i className="fa-solid fa-envelope" /></div>
                  <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="evelyn.harper@stanford.edu" className={styles.input} required />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <div className={styles.inputLabelRow}>
                  <label className={styles.inputLabel}>Secure Access Key</label>
                  {authMode === "signin" && <a href="#" className={styles.forgotLink} onClick={(e) => { e.preventDefault(); alert("Password reset routing is integrated via institutional SMTP relays."); }}>Forgot key?</a>}
                </div>
                <div className={styles.inputWrapper}>
                  <div className={styles.inputIcon}><i className="fa-solid fa-lock" /></div>
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
            <p className={styles.footerDesc}>An open-source, sovereign AI engine for drug discovery, target verification, and programmatic lab automation. Fully self-hostable under standard MIT protocol parameters.</p>
          </div>
          <div className={styles.footerCol}>
            <h5 className={styles.footerColTitle}><i className="fa-solid fa-cubes" style={{ marginRight: "6px" }} /> Platform Modules</h5>
            <ul className={styles.footerLinks}>
              <li><a href="#features" className={styles.footerLink}>Generative Chemistry</a></li>
              <li><a href="#features" className={styles.footerLink}>Structure-Based Docking</a></li>
              <li><a href="#features" className={styles.footerLink}>RNA Therapeutics</a></li>
              <li><a href="#features" className={styles.footerLink}>Peptide &amp; PROTAC</a></li>
              <li><a href="#features" className={styles.footerLink}>ADMET Toxicity</a></li>
              <li><a href="#features" className={styles.footerLink}>Lab Automation</a></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h5 className={styles.footerColTitle}><i className="fa-solid fa-layer-group" style={{ marginRight: "6px" }} /> Implemented Stack</h5>
            <ul className={styles.footerLinks}>
              <li><a href="#implementation" className={styles.footerLink}>Next.js Web UI</a></li>
              <li><a href="#implementation" className={styles.footerLink}>FastAPI API Gateway</a></li>
              <li><a href="#implementation" className={styles.footerLink}>Docker Microservices</a></li>
              <li><a href="#implementation" className={styles.footerLink}>ChromaDB Vector Store</a></li>
              <li><a href="#implementation" className={styles.footerLink}>Neon PostgreSQL</a></li>
              <li><a href="#implementation" className={styles.footerLink}>Swagger API Docs</a></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h5 className={styles.footerColTitle}><i className="fa-solid fa-code" style={{ marginRight: "6px" }} /> Developer Resources</h5>
            <ul className={styles.footerLinks}>
              <li><a href="https://github.com" target="_blank" className={styles.footerLink}>GitHub Repository</a></li>
              <li><a href="https://github.com" target="_blank" className={styles.footerLink}>Docker Quickstart</a></li>
              <li><a href="https://github.com" target="_blank" className={styles.footerLink}>pytest Test Suites</a></li>
              <li><a href="https://github.com" target="_blank" className={styles.footerLink}>Jest Coverage</a></li>
              <li><a href="https://github.com" target="_blank" className={styles.footerLink}>MIT License Details</a></li>
              <li><a href="mailto:support@molecraft.ai" className={styles.footerLink}>Academic Citation</a></li>
            </ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>&copy; 2026 MoleCraft Systems Inc. Sovereign deployment and cryptographic security are fully supported.</span>
          <span className={styles.footerBadge}>Local &amp; Sovereign Encryption Active</span>
        </div>
      </footer>
    </div>
  );
}
