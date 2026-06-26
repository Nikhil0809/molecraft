import subprocess
import sys
import signal
import os

AFFINITY_PORT = 8001
GENERATIVE_PORT = 8000
RAG_PORT = 8002

processes = []


def cleanup(signum=None, frame=None):
    print("\nShutting down services...")
    for p in processes:
        p.terminate()
    for p in processes:
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()
    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

BASE_DIR = os.path.dirname(__file__)

services = [
    ("affinity_predictor", AFFINITY_PORT),
    ("generative", GENERATIVE_PORT),
    ("rag_pipeline", RAG_PORT),
]

for name, port in services:
    dir_path = os.path.join(BASE_DIR, name)
    p = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0",
         "--port", str(port), "--reload"],
        cwd=dir_path,
    )
    processes.append(p)
    print(f"{name} running on http://localhost:{port}")

print("Press Ctrl+C to stop all services")

try:
    for p in processes:
        p.wait()
except KeyboardInterrupt:
    cleanup()
