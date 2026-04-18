"""
Search Service — FastAPI wrapper around the web search pipeline.
Exposes search results as a REST API so rag-api can consume them.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import requests
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SEARXNG_URL  = os.getenv("SEARXNG_URL",  "http://searxng:8080/search")
OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")

app = FastAPI(
    title="Search Service",
    description="Web search microservice powered by SearXNG + Ollama query rewriting",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(..., description="Natural-language search query")
    num_results: int = Field(5, ge=1, le=10)
    rewrite: bool = Field(True, description="Use Ollama to rewrite the query first")


class SearchResult(BaseModel):
    title: str
    url: str
    content: str


class SearchResponse(BaseModel):
    original_query: str
    search_query: str
    results: List[SearchResult]
    result_count: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def rewrite_query(user_query: str) -> str:
    """Use Ollama to convert natural language into a tight search query."""
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": (
                    f'Convert this into a concise web search query '
                    f'(return ONLY the query, nothing else):\n"{user_query}"'
                ),
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 64},
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("response", user_query).strip().strip('"')
    except Exception as e:
        logger.warning(f"Query rewrite failed, using original: {e}")
        return user_query


def search_web(query: str, num_results: int = 5) -> List[dict]:
    """Fetch results from the local SearXNG instance."""
    try:
        resp = requests.get(
            SEARXNG_URL,
            params={"q": query, "format": "json", "language": "en"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("results", [])[:num_results]
    except Exception as e:
        logger.error(f"SearXNG search failed: {e}")
        return []


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "healthy", "service": "search-service"}


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    """
    Rewrite the query with Ollama (optional), search SearXNG,
    and return structured results ready for RAG consumption.
    """
    logger.info(f"Search request: {req.query!r}")

    search_query = rewrite_query(req.query) if req.rewrite else req.query
    logger.info(f"Search query: {search_query!r}")

    raw = search_web(search_query, req.num_results)
    if not raw:
        raise HTTPException(status_code=502, detail="No results returned from SearXNG")

    results = [
        SearchResult(
            title=r.get("title", ""),
            url=r.get("url", ""),
            content=r.get("content", ""),
        )
        for r in raw
    ]

    logger.info(f"Returning {len(results)} results")
    return SearchResponse(
        original_query=req.query,
        search_query=search_query,
        results=results,
        result_count=len(results),
    )


@app.get("/")
def root():
    return {
        "service": "search-service",
        "endpoints": {
            "search": "POST /search",
            "health": "GET /health",
            "docs":   "GET /docs",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)