"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";

const CATEGORIES = [
  { icon: "doc", label: "Documentation", desc: "In-depth guides and API references", count: 24 },
  { icon: "tutorial", label: "Tutorials", desc: "Step-by-step walkthroughs", count: 12 },
  { icon: "faq", label: "FAQs", desc: "Frequently asked questions", count: 36 },
  { icon: "api", label: "API Reference", desc: "Full API specification", count: 48 },
];

const FAQS = [
  { q: "How does the AI molecule generator work?", a: "Our OmniMole foundation model uses a 12B parameter transformer trained on millions of bioactive molecules to generate novel compounds with desired properties." },
  { q: "What data sources power the platform?", a: "MoleCraft integrates ChEMBL, PubMed, PubChem, UniProt, PDB, and proprietary databases for comprehensive molecular intelligence." },
  { q: "Can I deploy MoleCraft on-premises?", a: "Yes. Our Enterprise plan includes Docker-based on-prem deployment with full data isolation and compliance controls." },
  { q: "What file formats are supported for import/export?", a: "We support SDF, MOL, SMI, PDB, MOL2, and XYZ formats for molecules, plus CSV/JSON for data export." },
  { q: "Is there a free tier available?", a: "Yes. The Starter plan offers 100 molecules per month free, with basic ADMET screening and community support." },
  { q: "How are binding affinities calculated?", a: "Affinities are predicted using ensemble docking simulations and our neural network trained on over 10 million binding measurements." },
];

function CatIcon({ type }: { type: string }) {
  const props = { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5" };
  switch (type) {
    case "doc": return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
    case "tutorial": return <svg {...props}><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>;
    case "faq": return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    case "api": return <svg {...props}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
    default: return null;
  }
}

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />
      <div className={styles.inner}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Help Center</h1>
          <p className={styles.desc}>Search documentation, tutorials, and FAQs</p>
          <div className={styles.searchWrapper}>
            <SearchInput placeholder="How can we help you?" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className={styles.categoriesGrid}>
          {CATEGORIES.map((cat) => (
            <Card key={cat.label} padding="lg" hover className={styles.catCard}>
              <div className={styles.catIcon}>{<CatIcon type={cat.icon} />}</div>
              <div className={styles.catInfo}>
                <h3 className={styles.catLabel}>{cat.label}</h3>
                <p className={styles.catDesc}>{cat.desc}</p>
              </div>
              <Badge variant="default">{cat.count} articles</Badge>
            </Card>
          ))}
        </div>

        <Card padding="lg">
          <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {FAQS.map((faq) => (
              <div key={faq.q} className={styles.faqItem}>
                <button className={styles.faqQ} onClick={() => setOpenFaq(openFaq === faq.q ? null : faq.q)}>
                  <span>{faq.q}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${styles.faqArrow} ${openFaq === faq.q ? styles.open : ""}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {openFaq === faq.q && (
                  <p className={styles.faqA}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card padding="lg" className={styles.supportCard}>
          <div className={styles.supportContent}>
            <h2 className={styles.supportTitle}>Still need help?</h2>
            <p className={styles.supportDesc}>Our support team is available 24/7 for Professional and Enterprise plans.</p>
            <Button>Contact Support</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
