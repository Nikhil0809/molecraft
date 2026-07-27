import os
import numpy as np

PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "local").lower()


class LocalEmbedder:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer
        self._model_name = model_name
        self._model: SentenceTransformer | None = None

    def _lazy_load(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)

    def embed(self, texts: list[str]) -> list[list[float]]:
        self._lazy_load()
        embeddings = self._model.encode(texts, show_progress_bar=False)
        if isinstance(embeddings, np.ndarray):
            return embeddings.tolist()
        return [e.tolist() if isinstance(e, np.ndarray) else e for e in embeddings]

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]

    @property
    def dimension(self) -> int:
        self._lazy_load()
        return self._model.get_sentence_embedding_dimension()

    @property
    def name(self) -> str:
        return self._model_name


class OpenAIEmbedder:
    def __init__(self, model_name: str = "text-embedding-3-small"):
        from openai import OpenAI
        self._model_name = model_name
        self._client: OpenAI | None = None
        self._api_key = os.environ.get("OPENAI_API_KEY", "")

    def _lazy_load(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self._api_key)

    def embed(self, texts: list[str]) -> list[list[float]]:
        self._lazy_load()
        resp = self._client.embeddings.create(model=self._model_name, input=texts)
        sorted_by_index = sorted(resp.data, key=lambda x: x.index)
        return [e.embedding for e in sorted_by_index]

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]

    @property
    def dimension(self) -> int:
        if "3-small" in self._model_name:
            return 1536
        if "3-large" in self._model_name:
            return 3072
        if "ada" in self._model_name:
            return 1536
        return 1536

    @property
    def name(self) -> str:
        return self._model_name


def get_embedder():
    if PROVIDER == "openai":
        return OpenAIEmbedder()
    return LocalEmbedder()
