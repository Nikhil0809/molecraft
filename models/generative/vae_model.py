import json
import math
import random
from pathlib import Path
from typing import Optional

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

MODEL_DIR = Path(__file__).parent
VOCAB_PATH = MODEL_DIR / "vocab.json"
VAE_WEIGHTS_PATH = MODEL_DIR / "vae.pt"
VAE_CONFIG_PATH = MODEL_DIR / "vae_config.json"

CHARSET = [
    " ", "#", "(", ")", "+", "-", ".", "/",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "=", "@",
    "B", "C", "F", "H", "I", "N", "O", "P", "S",
    "[", "\\", "]",
    "b", "c", "n", "o", "p", "s",
]
MAX_LEN = 120
LATENT_DIM = 128


class CharVocab:
    def __init__(self, chars: list[str]):
        self.char_to_idx = {c: i for i, c in enumerate(chars)}
        self.idx_to_char = {i: c for i, c in enumerate(chars)}
        self.vocab_size = len(chars)
        self.pad_idx = self.char_to_idx.get(" ", 0)

    def encode(self, smiles: str) -> list[int]:
        return [self.char_to_idx.get(c, self.pad_idx) for c in smiles]

    def decode(self, indices: list[int]) -> str:
        return "".join(self.idx_to_char.get(i, "") for i in indices)

    @classmethod
    def from_file(cls, path: Path) -> "CharVocab":
        with open(path) as f:
            chars = json.load(f)
        return cls(chars)

    def save(self, path: Path) -> None:
        with open(path, "w") as f:
            json.dump(self.idx_to_char, f)


def one_hot_encode(smiles: str, vocab: CharVocab, max_len: int = MAX_LEN) -> np.ndarray:
    indices = vocab.encode(smiles[:max_len])
    padded = indices + [vocab.pad_idx] * (max_len - len(indices))
    arr = np.zeros((max_len, vocab.vocab_size), dtype=np.float32)
    arr[np.arange(len(padded)), padded] = 1.0
    return arr


if TORCH_AVAILABLE:

    class VAEEmbedding(nn.Module):
        def __init__(self, vocab_size: int, embedding_dim: int = 64):
            super().__init__()
            self.embedding = nn.Embedding(vocab_size, embedding_dim)

        def forward(self, x):
            return self.embedding(x)

    class VAEEncoder(nn.Module):
        def __init__(self, vocab_size: int, latent_dim: int = LATENT_DIM,
                     hidden_dim: int = 256, embedding_dim: int = 64):
            super().__init__()
            self.embedding = VAEEmbedding(vocab_size, embedding_dim)
            self.conv1 = nn.Conv1d(embedding_dim, 64, kernel_size=5, padding=2)
            self.conv2 = nn.Conv1d(64, 128, kernel_size=5, padding=2)
            self.conv3 = nn.Conv1d(128, 256, kernel_size=5, padding=2)
            self.fc_mu = nn.Linear(256, latent_dim)
            self.fc_logvar = nn.Linear(256, latent_dim)

        def forward(self, x):
            x = self.embedding(x)
            x = x.transpose(1, 2)
            x = F.relu(self.conv1(x))
            x = F.relu(self.conv2(x))
            x = F.relu(self.conv3(x))
            x = x.mean(dim=2)
            mu = self.fc_mu(x)
            logvar = self.fc_logvar(x)
            return mu, logvar

    class VAEDecoder(nn.Module):
        def __init__(self, vocab_size: int, latent_dim: int = LATENT_DIM,
                     hidden_dim: int = 256):
            super().__init__()
            self.latent_to_hidden = nn.Linear(latent_dim, hidden_dim)
            self.gru = nn.GRU(hidden_dim, hidden_dim, batch_first=True, bidirectional=True)
            self.hidden_to_vocab = nn.Linear(hidden_dim * 2, vocab_size)

        def forward(self, z, max_len: int = MAX_LEN):
            batch_size = z.size(0)
            hidden = self.latent_to_hidden(z).unsqueeze(0)
            hidden = hidden.repeat(2, 1, 1)
            z_expanded = z.unsqueeze(1).repeat(1, max_len, 1)
            output, _ = self.gru(z_expanded, hidden)
            logits = self.hidden_to_vocab(output)
            return logits

    class MoleculeVAE(nn.Module):
        def __init__(self, vocab_size: int, latent_dim: int = LATENT_DIM):
            super().__init__()
            self.encoder = VAEEncoder(vocab_size, latent_dim)
            self.decoder = VAEDecoder(vocab_size, latent_dim)

        def reparameterize(self, mu, logvar):
            std = torch.exp(0.5 * logvar)
            eps = torch.randn_like(std)
            return mu + eps * std

        def forward(self, x):
            mu, logvar = self.encoder(x)
            z = self.reparameterize(mu, logvar)
            recon_logits = self.decoder(z, x.size(1))
            return recon_logits, mu, logvar

        def encode(self, x):
            mu, logvar = self.encoder(x)
            return mu

        def decode(self, z):
            logits = self.decoder(z)
            probs = F.softmax(logits, dim=-1)
            return probs

        @torch.no_grad()
        def sample(self, n: int, vocab: CharVocab, device: str = "cpu",
                   temperature: float = 1.0) -> list[str]:
            self.eval()
            z = torch.randn(n, LATENT_DIM).to(device)
            if temperature != 1.0:
                logits = self.decoder(z)
                scaled_logits = logits / temperature
                probs = F.softmax(scaled_logits, dim=-1)
                indices = torch.multinomial(probs.view(-1, probs.size(-1)),
                                            num_samples=1).view(n, -1)
            else:
                probs = self.decode(z)
                indices = probs.argmax(dim=-1)

            smiles_list = []
            for i in range(n):
                tokens = []
                for j in range(indices.size(1)):
                    idx = int(indices[i, j].item())
                    c = vocab.idx_to_char.get(idx, "")
                    if c == " ":
                        break
                    tokens.append(c)
                smi = "".join(tokens).strip()
                if smi:
                    smiles_list.append(smi)
            return smiles_list


def build_vocab() -> CharVocab:
    return CharVocab(CHARSET)


def train_vae(smiles_list: list[str], epochs: int = 50,
              batch_size: int = 64, lr: float = 1e-3,
              device: str = "cpu") -> MoleculeVAE:
    if not TORCH_AVAILABLE:
        raise ImportError("PyTorch is required for VAE training")

    vocab = build_vocab()
    vocab.save(VOCAB_PATH)

    encoded = []
    for smi in smiles_list:
        arr = one_hot_encode(smi, vocab)
        encoded.append(arr)

    X = np.array(encoded, dtype=np.float32)
    print(f"Training data: {len(X)} molecules, {X.shape[1]}x{X.shape[2]}")

    model = MoleculeVAE(vocab.vocab_size, LATENT_DIM).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    n_batches = max(1, len(X) // batch_size)

    for epoch in range(epochs):
        np.random.shuffle(X)
        total_loss = 0.0
        recon_weight = 1.0

        for b in range(n_batches):
            start = b * batch_size
            end = start + batch_size
            batch = X[start:end]
            batch_t = torch.from_numpy(batch).to(device)

            optimizer.zero_grad()
            recon_logits, mu, logvar = model(batch_t.argmax(dim=-1))
            recon_loss = F.cross_entropy(
                recon_logits.reshape(-1, recon_logits.size(-1)),
                batch_t.argmax(dim=-1).reshape(-1),
                reduction="mean",
            )
            kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
            kl_loss = kl_loss / batch_t.size(0)
            loss = recon_weight * recon_loss + 0.1 * kl_loss

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            total_loss += loss.item()

        avg_loss = total_loss / n_batches
        if (epoch + 1) % 10 == 0:
            samples = model.sample(3, vocab, device)
            print(f"Epoch {epoch+1}/{epochs}, loss={avg_loss:.4f}, samples={samples}")

    config = {
        "latent_dim": LATENT_DIM,
        "max_len": MAX_LEN,
        "vocab_size": vocab.vocab_size,
    }
    with open(VAE_CONFIG_PATH, "w") as f:
        json.dump(config, f)

    torch.save(model.state_dict(), VAE_WEIGHTS_PATH)
    print(f"VAE saved to {VAE_WEIGHTS_PATH}")
    return model


def load_vae(device: str = "cpu") -> Optional["MoleculeVAE"]:
    if not TORCH_AVAILABLE:
        return None

    if not VAE_WEIGHTS_PATH.exists() or not VOCAB_PATH.exists():
        return None

    try:
        with open(VAE_CONFIG_PATH) as f:
            config = json.load(f)
        vocab = CharVocab.from_file(VOCAB_PATH)
        model = MoleculeVAE(vocab.vocab_size, config.get("latent_dim", LATENT_DIM))
        model.load_state_dict(torch.load(VAE_WEIGHTS_PATH, map_location=device))
        model.eval()
        print(f"VAE loaded from {VAE_WEIGHTS_PATH}")
        return model
    except Exception as e:
        print(f"Failed to load VAE: {e}")
        return None


def generate_from_vae(model: "MoleculeVAE", vocab: CharVocab,
                      n: int = 5, temperature: float = 0.9,
                      device: str = "cpu") -> list[str]:
    return model.sample(n, vocab, device, temperature)
