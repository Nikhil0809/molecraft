import hashlib
from typing import Callable


class Deduplicator:
    def __init__(self, key_fn: Callable[[dict], str] | None = None):
        self._seen: set[str] = set()
        self._key_fn = key_fn or self._default_key

    @staticmethod
    def _default_key(doc: dict) -> str:
        content = doc.get("text", "") or doc.get("title", "") or str(doc)
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def is_duplicate(self, doc: dict) -> bool:
        key = self._key_fn(doc)
        if key in self._seen:
            return True
        self._seen.add(key)
        return False

    def filter(self, docs: list[dict]) -> list[dict]:
        return [d for d in docs if not self.is_duplicate(d)]

    def reset(self):
        self._seen.clear()
