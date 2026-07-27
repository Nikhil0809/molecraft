import re
from typing import Any

SDS_SECTIONS = {
    "1": "Identification",
    "2": "Hazards Identification",
    "3": "Composition/Ingredient Information",
    "4": "First Aid Measures",
    "5": "Fire Fighting Measures",
    "6": "Accidental Release Measures",
    "7": "Handling and Storage",
    "8": "Exposure Controls/Personal Protection",
    "9": "Physical and Chemical Properties",
    "10": "Stability and Reactivity",
    "11": "Toxicological Information",
    "12": "Ecological Information",
    "13": "Disposal Considerations",
    "14": "Transport Information",
    "15": "Regulatory Information",
    "16": "Other Information",
}


def parse_sds_text(raw_text: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current_section = "0"
    current_lines = []

    for line in raw_text.split("\n"):
        stripped = line.strip()
        match = re.match(r"^\s*(\d{1,2})[\.\s\)\-]+", stripped)
        if match:
            num = match.group(1)
            if num in SDS_SECTIONS or num in ("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"):
                if current_lines:
                    sections[current_section] = "\n".join(current_lines).strip()
                current_section = num
                current_lines = []
                remainder = stripped[match.end():].strip()
                if remainder:
                    current_lines.append(stripped)
                continue
        current_lines.append(stripped)

    if current_lines:
        sections[current_section] = "\n".join(current_lines).strip()

    return sections


def ingest_sds_text(raw_text: str, metadata: dict[str, Any] | None = None) -> list[dict]:
    sections = parse_sds_text(raw_text)
    docs = []
    for sec_num, sec_content in sections.items():
        sec_name = SDS_SECTIONS.get(sec_num, f"Section {sec_num}")
        doc_text = f"SDS Section {sec_num}: {sec_name}\n{sec_content}"
        docs.append({
            "text": doc_text,
            "metadata": {
                "source": "SDS",
                "section": sec_num,
                "section_name": sec_name,
                **(metadata or {}),
            },
        })
    return docs


def ingest_sds_file(filepath: str) -> list[dict]:
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        raw = f.read()
    return ingest_sds_text(raw, {"filepath": filepath})


def ingest_sds_files(filepaths: list[str]) -> list[dict]:
    all_docs = []
    for fp in filepaths:
        try:
            all_docs.extend(ingest_sds_file(fp))
        except Exception as e:
            print(f"[SDSIngestor] Error processing {fp}: {e}")
    return all_docs
