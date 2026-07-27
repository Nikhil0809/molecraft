import os
from PyPDF2 import PdfReader
from typing import Any


def extract_text_from_pdf(filepath: str) -> str:
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"PDF not found: {filepath}")
    reader = PdfReader(filepath)
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def ingest_pdf(filepath: str, extra_metadata: dict[str, Any] | None = None) -> list[dict]:
    text = extract_text_from_pdf(filepath)
    metadata = dict(extra_metadata or {})
    metadata.update({
        "source": "PDF",
        "filepath": os.path.abspath(filepath),
        "filename": os.path.basename(filepath),
    })
    return [{"text": text, "metadata": metadata}]


def ingest_pdfs(filepaths: list[str]) -> list[dict]:
    docs = []
    for fp in filepaths:
        try:
            docs.extend(ingest_pdf(fp))
        except Exception as e:
            print(f"[PDFIngestor] Error processing {fp}: {e}")
    return docs
