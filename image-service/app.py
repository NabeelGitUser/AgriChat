"""
Image Analysis Service - FastAPI wrapper
Analyzes crop images for disease detection and crop identification
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import logging
import os
import base64
from datetime import datetime

from image_analysis import CropImageAnalyzer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava:7b")

app = FastAPI(
    title="Crop Image Analysis Service",
    description="Analyze crop images for disease detection and identification",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global analyzer
analyzer: Optional[CropImageAnalyzer] = None

class QuestionRequest(BaseModel):
    question: str = Field(..., description="Question about the uploaded image")
    image_base64: str = Field(..., description="Base64 encoded image")

class AnalysisResponse(BaseModel):
    crop_identification: str
    disease_detection: str
    crop_description: str
    treatment_advice: str
    timestamp: str

@app.on_event("startup")
async def startup():
    global analyzer
    logger.info("Starting Image Analysis Service...")
    analyzer = CropImageAnalyzer(
        model_name=OLLAMA_VISION_MODEL,
        ollama_url=OLLAMA_URL
    )
    logger.info("✓ Image Analysis Service ready!")

@app.get("/health")
async def health():
    return {"status": "healthy", "model": OLLAMA_VISION_MODEL}

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    """
    Upload a crop image and get full analysis:
    - Crop identification
    - Disease detection  
    - Crop description
    - Treatment advice
    """
    # Validate file type
    if not file.filename.lower().endswith(
        ('.jpg', '.jpeg', '.png', '.webp')
    ):
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG, PNG, WEBP images supported"
        )

    try:
        logger.info(f"Analyzing image: {file.filename}")

        # Read image bytes and convert to base64
        image_bytes = await file.read()
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        # Set image directly without saving to disk
        analyzer.current_image_base64 = image_base64
        analyzer.current_image_path = file.filename

        # Run full analysis
        logger.info("Running full crop analysis...")
        result = analyzer.analyze_image()

        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        logger.info("✓ Analysis complete!")

        return AnalysisResponse(
            crop_identification=result["crop_identification"],
            disease_detection=result["disease_detection"],
            crop_description=result["crop_description"],
            treatment_advice=result["treatment_advice"],
            timestamp=datetime.now().isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask")
async def ask_about_image(
    file: UploadFile = File(...),
    question: str = "What disease does this crop have?"
):
    """
    Upload image and ask a specific question about it
    """
    if not file.filename.lower().endswith(
        ('.jpg', '.jpeg', '.png', '.webp')
    ):
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG, PNG, WEBP images supported"
        )

    try:
        image_bytes = await file.read()
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        analyzer.current_image_base64 = image_base64
        analyzer.current_image_path = file.filename

        answer = analyzer.ask_about_image(question)

        return {
            "question": question,
            "answer": answer,
            "image": file.filename,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "service": "image-analysis-service",
        "model": OLLAMA_VISION_MODEL,
        "endpoints": {
            "analyze": "POST /analyze - Full crop analysis",
            "ask": "POST /ask - Ask question about image",
            "health": "GET /health",
            "docs": "GET /docs"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8084)