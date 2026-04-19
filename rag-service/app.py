"""
FastAPI RAG Application
Complete API wrapper for RAG system with chat and knowledge base management
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
import os
import shutil
import httpx
from pathlib import Path
from datetime import datetime
import json

from rag_pipeline_ollama import DocumentLoader, TextChunker, VectorStore, OllamaRAG, clean_answer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rag_api.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
KNOWLEDGE_BASE_DIR = "./knowledge_base"
INDEX_PATH = "./rag_index"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
SEARCH_SERVICE_URL = os.getenv("SEARCH_SERVICE_URL", "http://search-service:8082")

# Confidence threshold
MIN_ANSWER_LENGTH = 50

os.makedirs(KNOWLEDGE_BASE_DIR, exist_ok=True)

app = FastAPI(
    title="RAG Knowledge Base API",
    description="API for RAG system with chat and document management",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
vector_store: Optional[VectorStore] = None
rag_system: Optional[OllamaRAG] = None
is_initialized = False


# ==================== Pydantic Models ====================

class ChatRequest(BaseModel):
    question: str = Field(..., description="Question to ask the RAG system")
    k: int = Field(3, ge=1, le=10, description="Number of context chunks to retrieve")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Model temperature")
    max_tokens: int = Field(512, ge=50, le=2048, description="Maximum tokens to generate")
    use_web_fallback: bool = Field(True, description="Use web search if KCC database has no good answer")


class ChatResponse(BaseModel):
    question: str
    answer: str
    sources: List[str]
    chunks_retrieved: int
    model: str
    timestamp: str
    used_web_search: bool = False


class DocumentInfo(BaseModel):
    filename: str
    filepath: str
    size_bytes: int
    uploaded_at: str
    file_type: str


class SystemStatus(BaseModel):
    status: str
    is_initialized: bool
    model: str
    documents_count: int
    chunks_count: int
    embedding_model: str
    knowledge_base_dir: str


class RebuildResponse(BaseModel):
    status: str
    documents_processed: int
    chunks_created: int
    message: str


# ==================== Helper Functions ====================

def initialize_rag_system():
    global vector_store, rag_system, is_initialized

    try:
        logger.info("Initializing RAG system...")

        if not os.path.exists(f"{INDEX_PATH}_index.faiss"):
            logger.warning("No index found. Please rebuild the knowledge base.")
            is_initialized = False
            return False

        vector_store = VectorStore(embedding_model_name=EMBEDDING_MODEL)
        vector_store.load(INDEX_PATH)
        logger.info(f"✓ Loaded vector store with {len(vector_store.chunks)} chunks")

        rag_system = OllamaRAG(
            model_name=OLLAMA_MODEL,
            vector_store=vector_store,
            ollama_url=OLLAMA_URL
        )
        logger.info(f"✓ RAG system initialized with model: {OLLAMA_MODEL}")

        is_initialized = True
        return True

    except Exception as e:
        logger.error(f"Failed to initialize RAG system: {e}")
        is_initialized = False
        return False


def rebuild_index_sync():
    global vector_store, rag_system

    try:
        logger.info("Starting index rebuild...")

        loader = DocumentLoader()
        documents = loader.load_documents(KNOWLEDGE_BASE_DIR)

        if not documents:
            logger.warning("No documents found in knowledge base")
            return {"documents_processed": 0, "chunks_created": 0}

        logger.info(f"Loaded {len(documents)} documents")

        chunker = TextChunker(chunk_size=500, chunk_overlap=50)
        chunks = chunker.chunk_documents(documents)
        logger.info(f"Created {len(chunks)} chunks")

        vector_store = VectorStore(embedding_model_name=EMBEDDING_MODEL)
        vector_store.build_index(chunks)
        vector_store.save(INDEX_PATH)
        logger.info("✓ Index saved")

        initialize_rag_system()

        return {
            "documents_processed": len(documents),
            "chunks_created": len(chunks)
        }

    except Exception as e:
        logger.error(f"Index rebuild failed: {e}")
        raise


def get_documents_list() -> List[DocumentInfo]:
    documents = []
    kb_path = Path(KNOWLEDGE_BASE_DIR)

    for file_path in kb_path.rglob('*'):
        if file_path.is_file() and file_path.suffix.lower() in ['.pdf', '.txt']:
            stat = file_path.stat()
            documents.append(DocumentInfo(
                filename=file_path.name,
                filepath=str(file_path),
                size_bytes=stat.st_size,
                uploaded_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                file_type=file_path.suffix.lower()[1:]
            ))

    return documents


def is_answer_confident(answer: str) -> bool:
    """Check if the RAG answer is good enough or needs web fallback"""
    if not answer:
        return False
    if answer.startswith("Error"):
        return False
    if len(answer.strip()) < MIN_ANSWER_LENGTH:
        return False

    uncertain_phrases = [
        "please provide",
        "i need the complete",
        "context is incomplete",
        "doesn't include information",
        "i don't have",
        "no information",
        "not mentioned",
        "cannot find",
        "unable to find",
        "not available",
        "i need more",
        "incomplete",
        "not enough information",
        "provide the full",
        "need more context"
    ]

    answer_lower = answer.lower()
    for phrase in uncertain_phrases:
        if phrase in answer_lower:
            return False

    return True


async def get_web_search_answer(
    question: str,
    temperature: float,
    max_tokens: int
) -> tuple[str, List[str]]:
    """Call search service and generate answer from web results"""
    try:
        logger.info(f"Falling back to web search for: {question[:50]}...")

        async with httpx.AsyncClient(timeout=60) as client:
            search_resp = await client.post(
                f"{SEARCH_SERVICE_URL}/search",
                json={"query": question, "num_results": 3, "rewrite": True}
            )

            if search_resp.status_code != 200:
                logger.error(f"Search service returned {search_resp.status_code}")
                return None, []

            search_data = search_resp.json()
            results = search_data.get("results", [])

            if not results:
                return None, []

            context = "\n\n".join([
                f"Source: {r['title']}\n{r['content']}"
                for r in results
            ])

            sources = [r['url'] for r in results]

            tamil_chars = set('அஆஇஈஉஊஎஏஐஒஓஔகசடதநபமயரலவழளறனஜஷஸஹ')
            is_tamil = any(char in tamil_chars for char in question)

            if is_tamil:
                prompt = f"""நீங்கள் ஒரு நிபுணர். கீழே உள்ள இணைய தகவல்களை பயன்படுத்தி தமிழில் மட்டும் 3-4 வரிகளில் நேரடியாக பதில் சொல்லுங்கள்.
முடிவு லேபல்கள் எழுதாதீர்கள். நேரடியாக பதிலை மட்டும் கொடுங்கள்.

தகவல்கள்:
{context}

கேள்வி: {question}

பதில்:"""
            else:
                prompt = f"""You are a knowledgeable assistant.
Use the following web search results to answer the question in 3-4 clear lines.
Do NOT write "YES agriculture related" or "Not agriculture related" or any label.
Output ONLY the direct answer.

Web Results:
{context}

Question: {question}

Answer:"""

            import requests as req_lib
            response = req_lib.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                },
                timeout=60
            )

            if response.status_code == 200:
                raw_answer = response.json().get('response', '').strip()
                # Clean the web search answer too
                answer = clean_answer(raw_answer)
                logger.info("✓ Web search answer generated")
                return answer, sources
            else:
                return None, []

    except Exception as e:
        logger.error(f"Web search fallback failed: {e}")
        return None, []


# ==================== Startup/Shutdown Events ====================

@app.on_event("startup")
async def startup_event():
    logger.info("=" * 50)
    logger.info("Starting RAG API Server...")
    logger.info("=" * 50)

    initialize_rag_system()

    if not is_initialized:
        logger.warning("⚠️  RAG system not initialized.")
    else:
        logger.info("✓ RAG API Server ready!")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down RAG API Server...")


# ==================== API Endpoints ====================

@app.get("/")
async def root():
    return {
        "message": "RAG Knowledge Base API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "chat": "/chat",
            "upload": "/documents/upload",
            "list_documents": "/documents",
            "delete_document": "/documents/{filename}",
            "rebuild_index": "/index/rebuild",
            "status": "/status"
        }
    }


@app.get("/status", response_model=SystemStatus)
async def get_status():
    documents = get_documents_list()
    return SystemStatus(
        status="ready" if is_initialized else "not_initialized",
        is_initialized=is_initialized,
        model=OLLAMA_MODEL,
        documents_count=len(documents),
        chunks_count=len(vector_store.chunks) if vector_store else 0,
        embedding_model=EMBEDDING_MODEL,
        knowledge_base_dir=KNOWLEDGE_BASE_DIR
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the RAG system.
    Automatically falls back to web search if KCC database
    doesn't have a confident answer.
    """
    if not is_initialized:
        raise HTTPException(
            status_code=503,
            detail="RAG system not initialized."
        )

    try:
        logger.info(f"Chat request: {request.question[:100]}...")

        # Step 1: Try KCC database first
        result = rag_system.query(
            question=request.question,
            k=request.k,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )

        answer = result['answer']
        sources = result['sources']
        used_web = False

        # Step 2: If answer not confident, fall back to web search
        if request.use_web_fallback and not is_answer_confident(answer):
            logger.info("KCC answer not confident enough, trying web search...")
            web_answer, web_sources = await get_web_search_answer(
                request.question,
                request.temperature,
                request.max_tokens
            )

            if web_answer and is_answer_confident(web_answer):
                answer = web_answer
                sources = web_sources
                used_web = True
                logger.info("✓ Using web search answer")
            else:
                logger.info("Web search also failed, using KCC answer")

        logger.info(f"✓ Response generated (web_search={used_web})")

        return ChatResponse(
            question=result['question'],
            answer=answer,
            sources=sources,
            chunks_retrieved=len(result['retrieved_chunks']),
            model=OLLAMA_MODEL,
            timestamp=datetime.now().isoformat(),
            used_web_search=used_web
        )

    except Exception as e:
        logger.error(f"Chat request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    try:
        documents = get_documents_list()
        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    auto_rebuild: bool = False
):
    if not file.filename.lower().endswith(('.pdf', '.txt')):
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported")

    try:
        file_path = os.path.join(KNOWLEDGE_BASE_DIR, file.filename)

        if os.path.exists(file_path):
            raise HTTPException(status_code=400, detail=f"File '{file.filename}' already exists.")

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(file_path)

        response = {
            "status": "success",
            "message": f"File '{file.filename}' uploaded successfully",
            "filename": file.filename,
            "size_bytes": file_size,
            "filepath": file_path
        }

        if auto_rebuild:
            result = rebuild_index_sync()
            response["index_rebuilt"] = True
            response["rebuild_stats"] = result
        else:
            response["index_rebuilt"] = False

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    file_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")

    real_path = os.path.realpath(file_path)
    real_kb_path = os.path.realpath(KNOWLEDGE_BASE_DIR)

    if not real_path.startswith(real_kb_path):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        os.remove(file_path)
        return {"status": "success", "message": f"File '{filename}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/index/rebuild", response_model=RebuildResponse)
async def rebuild_index(background_tasks: BackgroundTasks, background: bool = False):
    try:
        if background:
            background_tasks.add_task(rebuild_index_sync)
            return RebuildResponse(
                status="started",
                documents_processed=0,
                chunks_created=0,
                message="Index rebuild started in background."
            )
        else:
            result = rebuild_index_sync()
            return RebuildResponse(
                status="completed",
                documents_processed=result["documents_processed"],
                chunks_created=result["chunks_created"],
                message="Index rebuilt successfully"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "initialized": is_initialized
    }


# ==================== Run Server ====================

if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("🚀 Starting RAG Knowledge Base API Server")
    print("=" * 60)
    print(f"📂 Knowledge Base: {KNOWLEDGE_BASE_DIR}")
    print(f"🤖 Model: {OLLAMA_MODEL}")
    print(f"🔍 Search Service: {SEARCH_SERVICE_URL}")
    print(f"📊 Docs: http://localhost:8080/docs")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")