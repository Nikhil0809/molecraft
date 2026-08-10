import os
import torch
import argparse
from pathlib import Path
from huggingface_hub import hf_hub_download


def download_moldiff_weights(
    repo_id: str = "molecule-diffusion/moldiff-pocket",
    revision: str = "main",
    output_dir: str = "./model/checkpoints"
):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    files = [
        "moldiff_pocket.pt",
        "property_head.pt",
        "config.json"
    ]
    
    for fname in files:
        try:
            print(f"Downloading {fname}...")
            path = hf_hub_download(
                repo_id=repo_id,
                filename=fname,
                revision=revision,
                local_dir=output_dir,
                local_dir_use_symlinks=False
            )
            print(f"  Saved to {path}")
        except Exception as e:
            print(f"  Failed to download {fname}: {e}")


def create_dummy_checkpoints(output_dir: str = "./model/checkpoints"):
    """Create dummy checkpoints for testing without HF access"""
    import json
    from models.generative_diffusion.model.diffusion import MolDiffModel
    from models.generative_diffusion.model.property_guidance import PropertyGuidanceHead
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    model = MolDiffModel(
        hidden_dim=256,
        num_layers=6,
        num_heads=8,
        max_atoms=50,
        atom_types=100,
        bond_types=4,
        timesteps=1000
    )
    
    config = {
        "hidden_dim": 256,
        "num_layers": 6,
        "num_heads": 8,
        "max_atoms": 50,
        "atom_types": 100,
        "bond_types": 4,
        "timesteps": 1000,
        "guidance_scale": 3.0
    }
    
    torch.save({
        "model_state_dict": model.state_dict(),
        "config": config
    }, os.path.join(output_dir, "moldiff.pt"))
    
    prop_head = PropertyGuidanceHead(hidden_dim=256)
    torch.save(prop_head.state_dict(), os.path.join(output_dir, "property_head.pt"))
    
    with open(os.path.join(output_dir, "config.json"), "w") as f:
        json.dump(config, f, indent=2)
    
    print(f"Created dummy checkpoints in {output_dir}")


def download_patent_fingerprints(output_dir: str = "./data/patents"):
    """Download pre-computed patent fingerprints (placeholder)"""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    print("Patent fingerprint download not yet implemented")
    print("Run: python -m generative_diffusion.inference.ip_filter to build from USPTO bulk data")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download model weights and data")
    parser.add_argument("--output-dir", default="./model/checkpoints", help="Output directory")
    parser.add_argument("--dummy", action="store_true", help="Create dummy checkpoints for testing")
    parser.add_argument("--patents", action="store_true", help="Download patent data")
    
    args = parser.parse_args()
    
    if args.dummy:
        create_dummy_checkpoints(args.output_dir)
    else:
        download_moldiff_weights(output_dir=args.output_dir)
    
    if args.patents:
        download_patent_fingerprints()