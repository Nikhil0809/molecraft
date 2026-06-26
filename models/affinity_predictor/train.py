import numpy as np
import pickle
import random
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
from rdkit.Chem.rdchem import Mol
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error

random.seed(42)
np.random.seed(42)

MORGAN_RADIUS = 2
MORGAN_BITS = 2048

BUILDING_BLOCKS = [
    "c1ccccc1", "c1ccncc1", "c1ccsc1", "c1cocc1",
    "C1CCCCC1", "C1CCNCC1", "C1CCOCC1",
    "C(=O)O", "C(=O)N", "C(=O)NC", "CC(=O)O",
    "CN", "CCN", "C(C)C", "CC(C)C",
    "c1ccc(F)cc1", "c1ccc(Cl)cc1", "c1ccc(Br)cc1",
    "c1ccc(OC)cc1", "c1ccc(N)cc1",
    "C#N", "C=O", "CO", "O", "N", "C=C", "CC#C",
    "S(=O)(=O)N", "S(=O)(=O)C",
    "c1cccnc1", "c1cnccn1", "c1ccccn1",
    "C1CC1", "C1CCC1", "C1CCCC1",
    "c1ccc2ccccc2c1", "c1ccc3ccccc3c1",
    "C1COCCO1", "C1CNCCN1", "C1CCOC1",
    "c1ccc(C(F)(F)F)cc1", "c1ccc([N+](=O)[O-])cc1",
]

TEMPLATES = [
    "{a}-{b}", "{a}{b}", "{a}C{b}", "{a}CC{b}",
    "{a}NC{b}", "{a}OC{b}", "{a}C(=O){b}",
    "{a}C(=O)N{b}", "{a}N(C)C{b}", "{a}C(C){b}",
    "{a}c1ccc({b})cc1", "{a}c1cc({b})ccc1",
    "{a}C1CC1{b}", "{a}C1CCC1{b}", "{a}CC(=O){b}",
    "{a}C(=O)NC{b}", "{a}NC(=O){b}", "{a}COC{b}",
    "{a}C(N){b}", "{a}CC(=O)O{b}",
]


def random_molecule() -> str | None:
    for _ in range(300):
        a = random.choice(BUILDING_BLOCKS)
        b = random.choice(BUILDING_BLOCKS)
        template = random.choice(TEMPLATES)
        smi = template.format(a=a, b=b)
        mol = Chem.MolFromSmiles(smi)
        if mol is not None:
            try:
                canon = Chem.MolToSmiles(mol)
                m = Chem.MolFromSmiles(canon)
                if m is not None and m.GetNumAtoms() >= 6:
                    return canon
            except Exception:
                pass
    return None


def morgan_fingerprint(mol: Mol) -> np.ndarray:
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, MORGAN_RADIUS, nBits=MORGAN_BITS)
    arr = np.zeros((MORGAN_BITS,), dtype=np.float32)
    AllChem.DataStructs.ConvertToNumpyArray(fp, arr)
    return arr


def compute_descriptors(mol: Mol) -> dict:
    return {
        "MolWt": Descriptors.MolWt(mol),
        "LogP": Descriptors.MolLogP(mol),
        "HBD": Descriptors.NumHDonors(mol),
        "HBA": Descriptors.NumHAcceptors(mol),
        "TPSA": Descriptors.TPSA(mol),
        "NumRotatableBonds": Descriptors.NumRotatableBonds(mol),
        "NumAromaticRings": Descriptors.NumAromaticRings(mol),
        "NumHeteroatoms": Descriptors.NumHeteroatoms(mol),
        "FractionCSP3": Descriptors.FractionCSP3(mol),
        "RingCount": Descriptors.RingCount(mol),
        "NumSaturatedRings": rdMolDescriptors.CalcNumSaturatedRings(mol),
        "NumAliphaticRings": rdMolDescriptors.CalcNumAliphaticRings(mol),
    }


def realistic_affinity(mol: Mol, seed: int) -> float:
    rng = np.random.RandomState(seed)
    logp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    tpsa = Descriptors.TPSA(mol)
    mw = Descriptors.MolWt(mol)
    rot = Descriptors.NumRotatableBonds(mol)
    n_aromatic = Descriptors.NumAromaticRings(mol)
    frac_csp3 = Descriptors.FractionCSP3(mol)

    log_aff = 2.0
    if hbd > 5:
        log_aff += 0.3 * (hbd - 5)
    if hba > 10:
        log_aff += 0.2 * (hba - 10)
    if logp < 1.0:
        log_aff += (1.0 - logp) * 0.4
    elif logp > 5.0:
        log_aff += (logp - 5.0) * 0.3
    else:
        log_aff -= 0.2
    if tpsa < 30:
        log_aff += (30 - tpsa) * 0.05
    elif tpsa > 140:
        log_aff += (tpsa - 140) * 0.02
    if 300 <= mw <= 500:
        log_aff -= 0.2
    elif mw > 600:
        log_aff += 0.5
    if n_aromatic >= 2:
        log_aff -= 0.15 * min(n_aromatic, 4)
    if rot > 8:
        log_aff += 0.1 * (rot - 8)
    if frac_csp3 > 0.3:
        log_aff -= 0.1

    noise = rng.normal(0, 0.15)
    affinity_nm = 10 ** (log_aff + noise)
    return float(np.clip(affinity_nm, 0.1, 10000))


def compute_admet_properties(mol: Mol) -> dict:
    logp = Descriptors.MolLogP(mol)
    mw = Descriptors.MolWt(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    tpsa = Descriptors.TPSA(mol)
    rot = Descriptors.NumRotatableBonds(mol)
    n_aromatic = Descriptors.NumAromaticRings(mol)

    # Lipinski Rule-of-5 violations
    lipinski = 0
    if mw > 500:
        lipinski += 1
    if logp > 5:
        lipinski += 1
    if hbd > 5:
        lipinski += 1
    if hba > 10:
        lipinski += 1
    lipinski_pass = lipinski <= 1

    # hERG toxicity risk (logistic model based on logP, MW, basic nitrogen count)
    herg_score = 1.0 / (1.0 + np.exp(-(-4.5 + 0.6 * logp + 0.008 * mw)))
    herg_risk = "high" if herg_score > 0.7 else "medium" if herg_score > 0.4 else "low"

    # CYP inhibition risk
    cyp_score = 1.0 / (1.0 + np.exp(-(-3.0 + 0.3 * logp + 0.015 * mw + 0.4 * n_aromatic)))
    cyp_risk = "high" if cyp_score > 0.7 else "medium" if cyp_score > 0.4 else "low"

    # BBB permeability (logBB estimate)
    bbb_score = -0.1 + 0.3 * logp - 0.01 * tpsa
    bbb_penetrant = bbb_score > 0.3

    # Solubility (LogS estimate)
    log_solubility = 0.5 - 0.4 * logp - 0.01 * mw + 0.03 * hbd
    solubility_class = "high" if log_solubility > -2 else "moderate" if log_solubility > -4 else "low"

    return {
        "lipinski_violations": lipinski,
        "lipinski_pass": lipinski_pass,
        "herg_risk": herg_risk,
        "herg_score": round(float(herg_score), 3),
        "cyp_inhibition_risk": cyp_risk,
        "cyp_score": round(float(cyp_score), 3),
        "bbb_penetrant": bbb_penetrant,
        "bbb_score": round(float(bbb_score), 3),
        "solubility_log_s": round(float(log_solubility), 3),
        "solubility_class": solubility_class,
    }


def main():
    print("Generating training data with Morgan fingerprints...")

    descriptor_names = [
        "MolWt", "LogP", "HBD", "HBA", "TPSA",
        "NumRotatableBonds", "NumAromaticRings", "NumHeteroatoms",
        "FractionCSP3", "RingCount", "NumSaturatedRings", "NumAliphaticRings",
    ]

    fp_list = []
    desc_list = []
    affinities_list = []
    admet_list = []
    seen_smiles: set[str] = set()

    n_target = 8000
    attempts = 0
    while len(fp_list) < n_target and attempts < n_target * 15:
        attempts += 1
        smi = random_molecule()
        if smi is None or smi in seen_smiles:
            continue
        seen_smiles.add(smi)
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            continue
        try:
            fp = morgan_fingerprint(mol)
            d = list(compute_descriptors(mol).values())
            a = realistic_affinity(mol, seed=len(fp_list) * 7)
            admet = compute_admet_properties(mol)
            fp_list.append(fp)
            desc_list.append(d)
            affinities_list.append(a)
            admet_list.append(admet)
        except Exception:
            pass
        if len(fp_list) % 1000 == 0:
            print(f"  Generated {len(fp_list)} molecules...")

    X_fp = np.array(fp_list, dtype=np.float32)
    X_desc = np.array(desc_list, dtype=np.float32)
    X_combined = np.hstack([X_fp, X_desc])
    y = np.array(affinities_list, dtype=np.float64)

    print(f"\nTotal: {len(X_combined)} molecules")
    print(f"Fingerprint features: {X_fp.shape[1]}")
    print(f"Descriptor features: {X_desc.shape[1]}")
    print(f"Combined features: {X_combined.shape[1]}")

    if len(X_combined) < 100:
        print("ERROR: Not enough molecules generated. Check RDKit.")
        return

    X_train, X_test, y_train, y_test = train_test_split(
        X_combined, y, test_size=0.2, random_state=42
    )

    print("\nTraining RandomForest with Morgan fingerprints...")
    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=25,
        min_samples_leaf=3,
        n_jobs=-1,
        random_state=42,
        verbose=0,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(np.mean((y_test - y_pred) ** 2)))

    print(f"\nResults:")
    print(f"  R² = {r2:.4f}")
    print(f"  MAE = {mae:.2f} nM")
    print(f"  RMSE = {rmse:.2f} nM")

    # Applicability domain: compute training data centroid and mean distance
    train_center = np.mean(X_train, axis=0)
    train_dists = np.linalg.norm(X_train - train_center, axis=1)
    dist_mean = float(np.mean(train_dists))
    dist_std = float(np.std(train_dists))
    print(f"  Applicability domain: mean_dist={dist_mean:.2f}, std_dist={dist_std:.2f}")

    # Morgan bit importance from the model
    importances = model.feature_importances_
    fp_importance = importances[:MORGAN_BITS]
    desc_importance = importances[MORGAN_BITS:]

    # Top-10 Morgan bits (substructure patterns)
    top_bit_indices = np.argsort(fp_importance)[-10:][::-1]
    top_bit_smarts = []
    for idx in top_bit_indices:
        if fp_importance[idx] > 0.001:
            top_bit_smarts.append(int(idx))

    print(f"  Top Morgan bit indices: {top_bit_smarts}")

    model_dir = Path(__file__).parent
    with open(model_dir / "model.pkl", "wb") as f:
        pickle.dump({
            "model": model,
            "feature_names": {
                "descriptors": descriptor_names,
                "morgan_radius": MORGAN_RADIUS,
                "morgan_bits": MORGAN_BITS,
                "n_descriptors": len(descriptor_names),
                "n_fingerprint": MORGAN_BITS,
            },
            "r2_score": r2,
            "mae": mae,
            "rmse": rmse,
            "n_samples": len(X_combined),
            "applicability_domain": {
                "train_center": train_center.astype(np.float32),
                "dist_mean": dist_mean,
                "dist_std": dist_std,
                "threshold": dist_mean + 3.0 * dist_std,
            },
            "morgan_bit_importance": fp_importance.astype(np.float32),
        }, f)

    fp_imp_sum = float(np.sum(fp_importance))
    desc_imp_sum = float(np.sum(desc_importance))
    total_imp = fp_imp_sum + desc_imp_sum
    print(f"\nFeature group importance:")
    print(f"  Morgan fingerprints: {fp_imp_sum:.4f} ({fp_imp_sum / total_imp * 100:.1f}%)")
    print(f"  Descriptors:         {desc_imp_sum:.4f} ({desc_imp_sum / total_imp * 100:.1f}%)")
    print(f"\nModel saved to {model_dir / 'model.pkl'}")


if __name__ == "__main__":
    main()
