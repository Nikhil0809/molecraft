import re

CHEMISTRY_KEYWORDS = {
    "high": [
        r"\b(smiles|inchi|mol[12]|sdf|pdbqt|mol2)\b",
        r"\b(docking|molecular dynamics|md simulation|binding free energy)\b",
        r"\b(ic50|ec50|ki|kd|koff|kon|ic₅₀|ec₅₀)\b",
        r"\b(qsar|admet|adme|toxicity|cyp|herg|ames test)\b",
        r"\b(protac|molecular glue|bifunctional degrader)\b",
        r"\b(antibody|nanobody|bispecific|car-t|cdr)\b",
        r"\b(peptide|macrocycle|stapled peptide|cyclic peptide)\b",
        r"\b(rna|sirna|aso|mrna|antisense|gapmer)\b",
        r"\b(kinase|protease|receptor|enzyme|transporter|channel)\b",
        r"\b(inhibitor|agonist|antagonist|modulator|activator|blocker)\b",
        r"\b(clinical trial|phase [123]|first-in-human|fda|ema|approval)\b",
        r"\b(patent|freedom.to.operate|prior art|novelty|landscape)\b",
        r"\b(drug.likeness|lipinski|veber|lead.likeness|rule of 5)\b",
        r"\b(pharmacophore|scaffold|moiety|functional group|substructure)\b",
        r"\b(affinity|potency|selectivity|efficacy|bioavailability|solubility)\b",
        r"\b(moiety|chemotype|Markush|R-group|SAR)\b",
        r"\b(metabolite|prodrug|active metabolite|clearance|half.life)\b",
        r"\b(synthesis|retrosynthesis|synthetic route|reaction|yield)\b",
        r"\b(protein.ligand|protein.protein|complex|co.crystal|binding mode)\b",
    ],
    "medium": [
        r"\b(molecule|compound|chemical|drug|ligand)\b",
        r"\b(protein|enzyme|receptor|target|biomarker)\b",
        r"\b(cancer|tumor|oncology|disease|therapy|treatment)\b",
        r"\b(cell|assay|in.vitro|in.vivo|ex.vivo|phenotype)\b",
        r"\b(structure|sequence|mutation|variant|isoform|domain)\b",
        r"\b(genome|transcriptome|proteome|metabolome|omics|multi.omics)\b",
        r"\b(gene|expression|regulate|pathway|signaling|kegg|go term)\b",
        r"\b(formulation|delivery|nanoparticle|liposome|conjugate)\b",
        r"\b(chemistry|biochemistry|pharmacology|medicinal chem)\b",
        r"\b(diffdock|alphafold|esm|gnn|molformer|chemberta)\b",
    ],
    "low": [
        r"\b(water|solvent|ph|buffer|salt|crystal)\b",
        r"\b(temperature|pressure|concentration|dose|exposure)\b",
        r"\b(stability|degradation|aggregation|solubility|permeability)\b",
        r"\b(mass|spectrum|nmr|hplc|lc.ms|ms.ms|xray)\b",
    ],
}

CHEMISTRY_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for kws in CHEMISTRY_KEYWORDS.values()
    for p in kws
]


def is_chemistry_related(query: str, threshold: float = 0.1) -> tuple[bool, float, str]:
    query_lower = query.lower().strip()
    if not query_lower:
        return False, 0.0, "empty_query"

    tokens = query_lower.split()
    word_count = max(len(tokens), 1)

    matches = set()
    for pat in CHEMISTRY_PATTERNS:
        m = pat.search(query_lower)
        if m:
            matches.add(m.group(0).lower().strip())

    score = len(matches) / word_count

    if score >= threshold:
        return True, round(score, 3), "chemistry_related"

    HARD_REJECT = [
        r"\b(recipe|restaurant|movie|song|sports|game|travel|vacation)\b",
        r"\b(politics|news|weather|stock|crypto|bitcoin)\b",
        r"\b(celebrit|fashion|music|book|poem|art)\b",
        r"\b(car|bike|engine|insurance|loan|bank)\b",
    ]
    for pat in HARD_REJECT:
        if re.search(pat, query_lower):
            return False, round(score, 3), "non_chemistry_topic"

    if score > 0:
        return True, round(score, 3), "vaguely_chemistry_related"

    return False, round(score, 3), "non_chemistry_topic"
