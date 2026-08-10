export interface TargetEntry {
  id: string;
  name: string;
  gene: string;
  code: string;
  category: string;
  description: string;
}

export const TARGET_LIBRARY: TargetEntry[] = [
  { id: "cox2", name: "COX-2 (Cyclooxygenase-2)", gene: "PTGS2", code: "COX2", category: "Inflammation", description: "Cyclooxygenase-2, key enzyme for prostaglandin synthesis in inflammatory pathways." },
  { id: "egfr", name: "EGFR (Epidermal Growth Factor Receptor)", gene: "EGFR", code: "EGFR", category: "Oncology", description: "Receptor tyrosine kinase frequently overexpressed in solid tumors." },
  { id: "her2", name: "HER2 (Human Epidermal Growth Factor Receptor 2)", gene: "ERBB2", code: "HER2", category: "Oncology", description: "ErbB2 receptor amplified in breast and gastric cancers." },
  { id: "braf", name: "BRAF (B-Raf proto-oncogene)", gene: "BRAF", code: "BRAF", category: "Oncology", description: "Serine/threonine kinase mutated in melanoma and other cancers." },
  { id: "kras", name: "KRAS (G12C)", gene: "KRAS", code: "KRAS", category: "Oncology", description: "GTPase mutated in many solid tumors; driver oncogene." },
  { id: "ace2", name: "ACE2 (Angiotensin-converting enzyme 2)", gene: "ACE2", code: "ACE2", category: "Cardiovascular", description: "Carboxypeptidase entry receptor for SARS-CoV-2 and blood pressure regulator." },
  { id: "pd1", name: "PD-1 (Programmed Cell Death Protein 1)", gene: "PDCD1", code: "PD1", category: "Immunology", description: "Immune checkpoint receptor expressed on T cells." },
  { id: "pdl1", name: "PD-L1 (Programmed Death-Ligand 1)", gene: "CD274", code: "PDL1", category: "Immunology", description: "Ligand of PD-1 that suppresses anti-tumor immunity." },
  { id: "ctla4", name: "CTLA-4 (Cytotoxic T-Lymphocyte Associated Protein 4)", gene: "CTLA4", code: "CTLA4", category: "Immunology", description: "Immune checkpoint receptor that downregulates T-cell activation." },
  { id: "tnfa", name: "TNF-α (Tumor Necrosis Factor Alpha)", gene: "TNF", code: "TNFa", category: "Immunology", description: "Pro-inflammatory cytokine driving rheumatoid arthritis and autoimmune disease." },
  { id: "vegfa", name: "VEGF-A (Vascular Endothelial Growth Factor A)", gene: "VEGFA", code: "VEGFA", category: "Angiogenesis", description: "Key driver of tumor angiogenesis and vascular permeability." },
  { id: "glp1r", name: "GLP-1R (Glucagon-Like Peptide-1 Receptor)", gene: "GLP1R", code: "GLP1R", category: "Metabolic", description: "GLP-1 receptor regulating insulin secretion and appetite." },
  { id: "sglt2", name: "SGLT2 (Sodium-Glucose Cotransporter 2)", gene: "SLC5A2", code: "SGLT2", category: "Metabolic", description: "Renal glucose reuptake transporter targeted in type 2 diabetes." },
  { id: "jak1", name: "JAK1 (Janus Kinase 1)", gene: "JAK1", code: "JAK1", category: "Immunology", description: "Non-receptor tyrosine kinase in JAK-STAT signaling." },
  { id: "jak2", name: "JAK2 (Janus Kinase 2)", gene: "JAK2", code: "JAK2", category: "Oncology", description: "Tyrosine kinase implicated in myeloproliferative disorders." },
  { id: "cd20", name: "CD20 (Membrane-Spanning 4-Domains Subfamily A Member 1)", gene: "MS4A1", code: "CD20", category: "Oncology", description: "B-cell surface antigen targeted by monoclonal antibodies." },
  { id: "il6r", name: "IL-6R (Interleukin-6 Receptor)", gene: "IL6R", code: "IL6R", category: "Immunology", description: "Cytokine receptor mediating inflammatory signaling." },
  { id: "brd4", name: "BRD4 (Bromodomain-Containing Protein 4)", gene: "BRD4", code: "BRD4", category: "Epigenetics", description: "Bromodomain and extra-terminal protein involved in transcription regulation." },
  { id: "btk", name: "BTK (Bruton Tyrosine Kinase)", gene: "BTK", code: "BTK", category: "Immunology", description: "B-cell receptor signaling kinase in CLL and B-cell lymphomas." },
  { id: "bcl2", name: "BCL-2 (B-cell Lymphoma 2 protein)", gene: "BCL2", code: "BCL2", category: "Oncology", description: "Anti-apoptotic protein overexpressed in hematologic malignancies." },
  { id: "cdk4", name: "CDK4 (Cyclin-Dependent Kinase 4)", gene: "CDK4", code: "CDK4", category: "Oncology", description: "Cell-cycle kinase co-targeted with CDK6 in breast cancer." },
  { id: "cdk6", name: "CDK6 (Cyclin-Dependent Kinase 6)", gene: "CDK6", code: "CDK6", category: "Oncology", description: "Cell-cycle kinase co-targeted with CDK4." },
  { id: "mtor", name: "mTOR (Mammalian Target of Rapamycin)", gene: "MTOR", code: "MTOR", category: "Oncology", description: "Serine/threonine kinase regulating cell growth." },
  { id: "mek1", name: "MEK1 (MAPK/ERK Kinase 1)", gene: "MAP2K1", code: "MEK1", category: "Oncology", description: "Mitogen-activated protein kinase in the RAS pathway." },
  { id: "abl1", name: "ABL1 (ABL Proto-Oncogene)", gene: "ABL1", code: "ABL1", category: "Oncology", description: "Tyrosine kinase central to CML oncogene is BCR-ABL." },
  { id: "flt3", name: "Flt3 (Fms-like Tyrosine Kinase 3)", gene: "FLT3", code: "FLT3", category: "Oncology", description: "Tyrosine kinase in AML; blocked by midostaurin." },
  { id: "parp1", name: "PARP-1 (Poly(ADP-ribose) Polymerase 1)", gene: "PARP1", code: "PARP1", category: "Oncology", description: "DNA repair enzyme targeted in BRCA mutant cancers." },
  { id: "vhl", name: "VHL (Von-Hippel Lindau)", gene: "VHL", code: "VHL", category: "Oncology", description: "E3 ubiquitin ligase adaptor; exploited by HIF stabilization." },
  { id: "mdm2", name: "MDM2 (Mouse double minute 2 homolog)", gene: "MDM2", code: "MDM2", category: "Oncology", description: "Negative regulator of p53; PROTAC ligand target." },
  { id: "crbn", name: "CRBN (Cereblon)", gene: "CRBN", code: "CRBN", category: "Immunology", description: "E3 ligase substrate receptor; IMiD/degron target." },
  { id: "glp2r", name: "GLP-2R (Glucagon-Like Peptide-2 Receptor)", gene: "GLP2R", code: "GLP2R", category: "Metabolic", description: "Intestinal growth factor receptor in short-bowel syndrome." },
  { id: "hif2", name: "HIF-2α", gene: "EPAS1", code: "HIF2", category: "Oncology", description: "Hypoxia-inducible transcription factor in renal cell carcinoma." },
  { id: "ptgfr", name: "PTGFR", gene: "PTGFR", code: "PTGFR", category: "Reproductive", description: "Prostaglandin F receptor in labor repurposing." },
  { id: "ddr1", name: "DDR-1", gene: "DDR1", code: "DDR1", category: "Enzymology", description: "Discoidin domain receptor tyrosine kinase." },
  { id: "ns3", name: "NS3/4A Protease", gene: "HCV-NS3", code: "NS3", category: "Infectious Disease", description: "Hepatitis C viral protease inhibitor." },
  { id: "ca9", name: "CA IX (Carbonic Anhydrase IX)", gene: "CA9", code: "CA9", category: "Oncology", description: "Tumor hypoxia marker; growth inhibitor." },
  { id: "apoa1", name: "ApoA-I Mimetics", gene: "APOA1", code: "APOA1", category: "Cardiovascular", description: "HDL nanodisc peptide enhancer." },
  { id: "c3", name: "C3 Complement", gene: "C3", code: "C3", category: "Immunology", description: "Complement protein for immunotherapy of dry-AMD." },
  { id: "f10", name: "Factor Xa", gene: "F10", code: "F10", category: "Cardiovascular", description: "Coagulation factor for anticoagulation agents." },
  { id: "adora2a", name: "A2A Receptor", gene: "ADORA2A", code: "ADORA2A", category: "Neuroscience", description: "Adenosine A2A antagonist for Parkinson's." },
  { id: "esr1", name: "ESR1 (Estrogen Receptor Alpha)", gene: "ESR1", code: "ESR1", category: "Oncology", description: "Nuclear hormone receptor in breast cancer." },
  { id: "ar", name: "AR (Androgen Receptor)", gene: "AR", code: "AR", category: "Oncology", description: "Nuclear receptor driving prostate cancer." },
  { id: "herg", name: "KCNH2 (hERG)", gene: "KCNH2", code: "HERG", category: "Cardiovascular", description: "Potassium channel; key cardiac safety target." },
  { id: "gstp1", name: "GSTP1", gene: "GSTP1", code: "GSTP1", category: "Oncology", description: "Glutathione S-transferase P1." },
  { id: "serpina1", name: "SERPINA1", gene: "SERPINA1", code: "SERPINA1", category: "Inherited Disease", description: "Alpha-1 antitrypsin." },
  { id: "app", name: "Amyloid Beta (Aβ)", gene: "APP", code: "APP", category: "Neuroscience", description: "Alzheimer's pathological peptide." },
  { id: "hmgcr", name: "HMG-CoA Reductase", gene: "HMGCR", code: "HMGCR", category: "Cardiovascular", description: "Cholesterol biosynthesis enzyme, statin target." },
  { id: "dpp4", name: "DPP-4", gene: "DPP4", code: "DPP4", category: "Metabolic", description: "Dipeptidyl peptidase-4 for gliptins in diabetes." },
];

export function searchTargets(query: string, limit = 12): TargetEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return TARGET_LIBRARY.slice(0, limit);
  return TARGET_LIBRARY.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.gene.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
  ).slice(0, limit);
}

export function targetOptionLabel(t: TargetEntry): string {
  return `${t.name} · ${t.code}`;
}