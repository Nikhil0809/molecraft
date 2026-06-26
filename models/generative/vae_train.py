import sys
from pathlib import Path

from rdkit import Chem
from rdkit import RDLogger

RDLogger.logger().setLevel(RDLogger.ERROR)

import numpy as np

from vae_model import build_vocab, train_vae

DRUG_SMILES = [
    "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F",
    "CN1CCN(CC1)C2=CC(=C(C=C2)NC3=NC=CC(=N3)C4=CN(C5=CC=CC=C45)C)NC(=O)C=C",
    "COC1=C(C=C2C(=C1)N=CN=C2NC3=CC(=C(C=C3)F)Cl)OCCCN4CCOCC4",
    "COCCOC1=C(C=C2C(=C1)N=CN=C2NC3=CC=CC(=C3)C#C)OCCOC",
    "CS(=O)(=O)CCNCC1=CC=CO1C2=CC=C(C=C2F)C(=O)NC3=CC4=C(C=C3Cl)NC(=O)CC4",
    "CC1N(CC2C1N(C3=C2C=NC4=C3C=CN4)C)C(=O)CC#N",
    "CCS(=O)(=O)N1CC(C1)(CC#N)C2=C3C=CNC3=NC=N2",
    "C1CC1CC(C2=CC=NN2)C3=C4C=CNC4=NC=N3",
    "CCS(=O)(=O)C1=CC=C(C=C1)C2=NC3=C(C=C2)N=CN3C4=CC=C(C=C4)F",
    "OC(=O)C1CC(N(C1)C(=O)C2CC2)C(=O)NCC3=CC(=CC=C3)Cl",
    "CN1C(=O)C2=C(C(=O)N(C1=O)C)NC(=O)NC2=O",
    "CC(C)NCC(O)COC1=CC=C(C=C1)CCN",
    "COC1=CC2=C(C=C1OC)C(=O)C(=C2)O",
    "CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)OCC(=O)O)",
    "CC(C)(C)NC(=O)C1=CC2=C(C=C1)NC(=O)C2",
    "CC1=C(C(=O)O)NC2=C1C=CC(=C2)Cl",
    "CCN(CC)CCCC(C)NC1=C2C=CC(=O)C=C2OC3=C1C=CC(=C3)Br",
    "CN1CCN(CC1)C2=C3C=CC(=O)C=C3OC4=C2C=C(C=C4)Cl",
    "CC(=O)OC1=CC=CC=C1C(=O)O",
    "CC(C)C1=CC=C(C=C1)C(C)C(=O)O",
    "C1=CC(=C(C=C1O)Cl)C2=C(C(=O)O)CC2",
    "CC1=C(C(=O)O)NC2=C1C=CC(=C2)C(F)(F)F",
    "CN(C)CCN1C(=O)C2=C(C3=CC=CC=C3C=C2)C1=O",
    "CC1=CC(=NO1)C2=CC=CC=C2C3=CC=C(C=C3)S(=O)(=O)N",
    "CC(=O)NC1=CC=C(C=C1)C2=CC=CC=C2C3=CC=CC=C3",
    "CC(C)(C)C1=CC2=C(C=C1)C(=O)C3=C(C=CC=C3)O2",
    "CC1=C(C=C(C=C1)Cl)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F",
    "CC(C)NC(C)C(=O)N1CC2=C(C=CC=C2)CC1C3=CC=CC=C3",
    "CN1CCN(CC1)C2=CC3=C(C=C2)N=CN=C3NC4=CC5=C(C=C4F)NC(=O)C5",
    "COC1=CC2=C(C=C1OC)C(=O)C(=C2)COC3=CC=CC=C3",
    "CC1=CC2=C(C3=C(C=CC=C3)C(=O)O2)C=C1",
    "CC(C)(C)C1=CC(=O)C2=C(O1)C3=C(C=C2)OCCO3",
    "CCN1C(=O)C2=C(C3=CC=CC=C3C=C2)C1=O",
    "CN1C(=O)CN=C(C2=CC=CC=C2)C3=CC=CC=C13",
    "CC1=CC(=NO1)C2=CC=CC=C2S(=O)(=O)N",
    "CC1=C(C2=C(C=CC=C2)NC1=O)C(=O)O",
    "COC1=C(C=C2C(=C1)C(=O)C(=C2)OC)O",
    "CC(C)(C)NC(=O)C1=CC2=C(C=CC=C2)C=C1",
    "CC1=CC=CC(=C1NC(=O)C2=CC=C(C=C2)Cl)C(=O)O",
    "CNC(=O)C1=CC(=C(C=C1)Cl)C2=CC=CC=C2O",
    "CC1=CC=C(C=C1)C2=CC=CC=C2C3=CC(=NN3)C(F)(F)F",
    "COC1=CC=C(C=C1)C2=CC(=O)C3=C(O2)C=CC=C3",
    "CC(C)(C)C1=CN(C2=CC=CC=C2)C(=O)N1",
    "CC1=NC2=C(C(=O)N(C1=O)C)C=CC=C2",
    "CC(=O)NC1=CC=CC=C1C(=O)NC2=CC=CC=C2",
    "CC1=C(C2=CC=CC=C2C=C1)C(=O)O",
    "CCN1C(=O)C=C(NC1=O)C2=CC=CC=C2",
    "CC1=C(C2=CC=CC=C2)C(=O)O1",
    "COC1=CC=CC=C1C2=CC=CC=C2C3=CC(=NO3)C(F)(F)F",
    "CC(C)(C)C1=NC(=O)C2=C(N1)C=CC=C2",
]

BUILDING_BLOCKS = [
    "c1ccccc1C(=O)O", "c1ccncc1", "c1ccsc1", "CC(=O)O",
    "CS(=O)(=O)N", "CN1CCN(CC1)", "C1CCC1", "c1ccccc1F",
    "c1cccnc1", "c1ccc2ccccc2c1", "C#N", "C=C",
    "OCCOC", "C1CCCC1", "CN(C)C", "S(=O)(=O)N",
    "C1COCCN1", "c1ccc(F)cc1", "CC(C)(C)", "CF",
    "CCN(C)CC", "C1CNCCN1", "c1ccco1", "c1cccs1",
    "C1CC1", "C1CCCCC1", "C1CCOCC1", "CC(=O)NC",
    "C(=O)O", "c1ccc(Cl)cc1", "c1ccc(Br)cc1",
    "c1ccc(OC)cc1", "c1ccc(N)cc1",
]

TEMPLATES = [
    "{a}{b}", "{a}C{b}", "{a}CC{b}", "{a}NC{b}", "{a}OC{b}",
    "{a}C(=O){b}", "{a}C(=O)N{b}", "{a}N(C)C{b}",
    "{a}c1ccc({b})cc1", "{a}C1CC1{b}",
]


def generate_synthetic_smiles(count: int = 5000) -> list[str]:
    seen: set[str] = set(DRUG_SMILES)
    result: list[str] = []
    attempts = 0
    while len(result) < count and attempts < count * 50:
        attempts += 1
        a = np.random.choice(BUILDING_BLOCKS)
        b = np.random.choice(BUILDING_BLOCKS)
        template = np.random.choice(TEMPLATES)
        smi = template.format(a=a, b=b)
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            continue
        try:
            canon = Chem.MolToSmiles(mol)
            if canon not in seen and len(canon) <= 100 and canon.count("(") == canon.count(")"):
                seen.add(canon)
                result.append(canon)
        except Exception:
            pass
    return DRUG_SMILES + result


def main():
    print("Generating training SMILES...")
    smiles_list = generate_synthetic_smiles(5000)
    print(f"Total SMILES: {len(smiles_list)}")

    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Training VAE on device: {device}")
        model = train_vae(smiles_list, epochs=80, batch_size=64, device=device)
        print("VAE training complete!")
        samples = model.sample(5, build_vocab(), device)
        print(f"Sample generations: {samples}")
    except ImportError as e:
        print(f"Cannot train VAE: {e}")
        print("Install PyTorch: pip install torch")


if __name__ == "__main__":
    main()
