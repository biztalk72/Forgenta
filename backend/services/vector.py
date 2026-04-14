"""ChromaDB vector search service for Forgenta."""

import os
import chromadb
import ollama

EMBED_MODEL = os.getenv("EMBED_MODEL", "mxbai-embed-large:latest")
_OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
_ollama_client = ollama.Client(host=_OLLAMA_HOST)

_client = chromadb.Client()
_collection = None


def get_collection():
    global _collection
    if _collection is None:
        _collection = _client.get_or_create_collection(
            name="forgenta_docs",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def embed_text(text: str) -> list[float]:
    """Generate embedding using Ollama."""
    response = _ollama_client.embed(model=EMBED_MODEL, input=text)
    return response["embeddings"][0]


def add_documents(documents: list[dict]):
    """Add documents to ChromaDB."""
    col = get_collection()
    ids = [doc["id"] for doc in documents]
    texts = [doc["content"] for doc in documents]
    metadatas = [
        {
            "title": doc["title"],
            "domain": doc["domain"],
            "has_data": bool(doc.get("data")),
        }
        for doc in documents
    ]
    embeddings = [embed_text(t) for t in texts]
    col.upsert(ids=ids, documents=texts, metadatas=metadatas, embeddings=embeddings)


def search(query: str, n_results: int = 3) -> list[dict]:
    """Search similar documents."""
    col = get_collection()
    if col.count() == 0:
        return []
    query_embedding = embed_text(query)
    results = col.query(query_embeddings=[query_embedding], n_results=n_results)
    docs = []
    for i in range(len(results["ids"][0])):
        docs.append(
            {
                "id": results["ids"][0][i],
                "content": results["documents"][0][i],
                "title": results["metadatas"][0][i].get("title", ""),
                "domain": results["metadatas"][0][i].get("domain", ""),
                "distance": results["distances"][0][i] if results.get("distances") else None,
            }
        )
    return docs


# --- Prompt search (separate collection) ---

_prompt_collection = None


def get_prompt_collection():
    global _prompt_collection
    if _prompt_collection is None:
        _prompt_collection = _client.get_or_create_collection(
            name="forgenta_prompts",
            metadata={"hnsw:space": "cosine"},
        )
    return _prompt_collection


def add_prompt(prompt_id: str, text: str, metadata: dict | None = None):
    """Store a prompt in the prompt collection."""
    col = get_prompt_collection()
    embedding = embed_text(text)
    col.upsert(
        ids=[prompt_id],
        documents=[text],
        metadatas=[metadata or {}],
        embeddings=[embedding],
    )


def search_similar_prompts(query: str, n_results: int = 5) -> list[dict]:
    """Search similar prompts."""
    col = get_prompt_collection()
    if col.count() == 0:
        return []
    query_embedding = embed_text(query)
    results = col.query(query_embeddings=[query_embedding], n_results=n_results)
    prompts = []
    for i in range(len(results["ids"][0])):
        prompts.append(
            {
                "id": results["ids"][0][i],
                "text": results["documents"][0][i],
                "distance": results["distances"][0][i] if results.get("distances") else None,
            }
        )
    return prompts
