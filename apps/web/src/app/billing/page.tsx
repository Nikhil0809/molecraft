"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import styles from "./page.module.css";

const PLANS = [
  {
    name: "Starter",
    price: "$0",
    period: "free",
    desc: "For individual researchers exploring AI drug discovery",
    features: ["100 molecules/month", "5 predictions/day", "Basic ADMET screening", "Community support"],
    current: false,
    popular: false,
  },
  {
    name: "Professional",
    price: "$49",
    period: "/month",
    desc: "For active research groups and academic labs",
    features: ["10,000 molecules/month", "Unlimited predictions", "Full ADMET + Docking suite", "Priority support", "Team collaboration", "API access"],
    current: true,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$199",
    period: "/month",
    desc: "For institutions and biotech companies",
    features: ["Unlimited molecules", "Unlimited predictions", "All OmniMole modules", "Dedicated support", "Custom integrations", "On-prem deployment", "SLA guarantee", "Audit logs"],
    current: false,
    popular: false,
  },
];

const INVOICES = [
  { id: "INV-2026-001", date: "Jun 1, 2026", amount: "$49.00", status: "paid", plan: "Professional" },
  { id: "INV-2026-002", date: "May 1, 2026", amount: "$49.00", status: "paid", plan: "Professional" },
  { id: "INV-2026-003", date: "Apr 1, 2026", amount: "$49.00", status: "paid", plan: "Professional" },
  { id: "INV-2026-004", date: "Mar 1, 2026", amount: "$49.00", status: "paid", plan: "Professional" },
];

const USAGE = [
  { label: "Molecules Generated", used: 8472, limit: 10000 },
  { label: "Predictions Run", used: 12483, limit: 15000 },
  { label: "Team Members", used: 4, limit: 10 },
  { label: "Storage", used: 2.4, limit: 10, unit: "GB" },
];

export default function BillingPage() {
  const [showCancel, setShowCancel] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Billing</h1>
            <p className={styles.desc}>Manage your subscription and usage</p>
          </div>
        </div>

        {/* Current Plan */}
        <Card padding="lg">
          <div className={styles.planHeader}>
            <div>
              <h2 className={styles.planName}>Professional Plan</h2>
              <p className={styles.planPrice}>$49<span className={styles.planPeriod}>/month</span></p>
            </div>
            <div className={styles.planActions}>
              <Badge variant="green">Active</Badge>
              <Button variant="secondary" size="sm" onClick={() => setShowCancel(true)}>Cancel Plan</Button>
            </div>
          </div>

          {/* Usage Bars */}
          <div className={styles.usageGrid}>
            {USAGE.map((item) => (
              <div key={item.label} className={styles.usageItem}>
                <div className={styles.usageTop}>
                  <span className={styles.usageLabel}>{item.label}</span>
                  <span className={styles.usageValue}>{item.used}{item.unit || ""} / {item.limit}{item.unit || ""}</span>
                </div>
                <div className={styles.usageTrack}>
                  <div
                    className={styles.usageBar}
                    style={{ width: `${Math.min((item.used / item.limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Plans */}
        <h2 className={styles.sectionTitle}>Available Plans</h2>
        <div className={styles.plansGrid}>
          {PLANS.map((plan) => (
            <Card key={plan.name} padding="lg" className={`${plan.popular ? styles.popular : ""}`}>
              {plan.popular && <Badge variant="purple" className={styles.popularBadge}>Most Popular</Badge>}
              <div className={styles.planCard}>
                <h3 className={styles.planCardName}>{plan.name}</h3>
                <p className={styles.planCardPrice}>{plan.price}<span className={styles.planCardPeriod}>{plan.period}</span></p>
                <p className={styles.planCardDesc}>{plan.desc}</p>
                <ul className={styles.planFeatures}>
                  {plan.features.map((f) => (
                    <li key={f} className={styles.planFeature}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.current ? "secondary" : "primary"} className={styles.planBtn} disabled={plan.current}>
                  {plan.current ? "Current Plan" : "Upgrade"}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Invoices */}
        <Card padding="lg">
          <h2 className={styles.sectionTitle}>Payment History</h2>
          <div className={styles.invoiceList}>
            <div className={styles.invoiceHeader}>
              <span>Invoice</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {INVOICES.map((inv) => (
              <div key={inv.id} className={styles.invoiceRow}>
                <span className={styles.invoiceId}>{inv.id}</span>
                <span className={styles.invoiceDate}>{inv.date}</span>
                <span className={styles.invoiceAmount}>{inv.amount}</span>
                <Badge variant="green">{inv.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Cancel Subscription">
        <p className={styles.cancelText}>Are you sure you want to cancel your Professional plan? You'll lose access to premium features at the end of the billing period.</p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setShowCancel(false)}>Keep Plan</Button>
          <Button variant="danger" onClick={() => { toast({ title: "Cancellation scheduled", type: "warning" }); setShowCancel(false); }}>Confirm Cancellation</Button>
        </div>
      </Modal>
    </div>
  );
}
