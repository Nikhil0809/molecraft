import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "models"))

os.environ.setdefault("PYTHONUNBUFFERED", "1")


def load_service_module(service_dir_name: str):
    """Import a service's main.py under a unique module name so multiple
    services can be tested in one pytest run without 'main' collisions."""
    import importlib.util

    service_dir = Path(__file__).parent.parent / "models" / service_dir_name
    if str(service_dir) not in sys.path:
        sys.path.insert(0, str(service_dir))
    target = service_dir / "main.py"
    name = f"svc_{service_dir_name}"
    spec = importlib.util.spec_from_file_location(name, target)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="session")
def event_loop():
    import asyncio

    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def sample_smiles():
    return "CC(=O)OC1=CC=CC=C1C(=O)O"


@pytest.fixture
def sample_protein_sequence():
    return "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDAAWDNESFFQQQQYTMRNLLGKQEPERVT"


@pytest.fixture
def sample_rna_sequence():
    return "AUGGCGACCCUGGAUGAGCU"
