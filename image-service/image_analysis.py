"""
Crop Image Analysis Module
Uses Ollama Vision Models (llama3.2-vision) for:
- Crop type detection
- Disease detection
- Crop description
- Follow-up Q&A about the image
"""

import requests
import base64
import json
from pathlib import Path


class CropImageAnalyzer:
    """
    Analyzes crop images using Ollama vision models.
    Detects crop type, diseases, and answers questions about the image.
    """

    def __init__(
        self,
        model_name: str = "llava:7b",
        ollama_url: str = "http://localhost:11434"
    ):
        self.model_name = model_name
        self.ollama_url = ollama_url
        self.current_image_base64 = None   # stores last uploaded image
        self.current_image_path = None     # stores last image path

        self._test_connection()

    # ──────────────────────────────────────────────
    # INTERNAL HELPERS
    # ──────────────────────────────────────────────

    def _test_connection(self):
        """Check if Ollama is running and model is available"""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags")
            if response.status_code == 200:
                models = [m['name'] for m in response.json().get('models', [])]
                if any(self.model_name in m for m in models):
                    print(f"✓ Connected to Ollama — model: {self.model_name}")
                else:
                    print(f"⚠️  Model '{self.model_name}' not found!")
                    print(f"   Run: ollama pull {self.model_name}")
                    print(f"   Available models: {', '.join(models)}")
            else:
                print("⚠️  Could not connect to Ollama!")
        except Exception as e:
            print(f"❌ Ollama connection error: {e}")
            print("   Make sure Ollama is running: ollama serve")

    def _image_to_base64(self, image_path: str) -> str:
        """Convert image file to base64 string for Ollama API"""
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def _ask_vision(self, prompt: str, image_base64: str) -> str:
        """Send image + prompt to Ollama vision model"""
        try:
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "images": [image_base64],   # base64 image here
                    "stream": False,
                    "options": {
                        "temperature": 0.3,     # low = more factual answers
                        "num_predict": 512
                    }
                }
            )
            if response.status_code == 200:
                return response.json().get("response", "").strip()
            else:
                return f"Error: {response.status_code}"
        except Exception as e:
            return f"Error: {e}"

    # ──────────────────────────────────────────────
    # PUBLIC METHODS
    # ──────────────────────────────────────────────

    def load_image(self, image_path: str) -> bool:
        """
        Load and store image for analysis and follow-up Q&A.
        Must be called before analyze_image() or ask_about_image().
        """
        path = Path(image_path)

        # Check file exists
        if not path.exists():
            print(f"❌ Image not found: {image_path}")
            return False

        # Check file type
        if path.suffix.lower() not in ['.jpg', '.jpeg', '.png', '.webp']:
            print(f"❌ Unsupported format: {path.suffix}")
            print("   Supported: .jpg, .jpeg, .png, .webp")
            return False

        self.current_image_base64 = self._image_to_base64(image_path)
        self.current_image_path = image_path
        print(f"✓ Image loaded: {path.name}")
        return True

    def identify_crop(self) -> str:
        """Detect what crop is in the image"""
        if not self.current_image_base64:
            return "❌ No image loaded. Call load_image() first."

        prompt = """You are an expert botanist and agricultural scientist.
        Identify the exact crop in this image.

        Answer STRICTLY in this format:
        Crop Name: <specific crop name>
        Scientific Name: <scientific name>
        Plant Health: <Healthy/Stressed/Diseased>
        Confidence: <High/Medium/Low>"""
        
        return self._ask_vision(prompt, self.current_image_base64)

    def detect_disease(self) -> str:
        """Detect diseases or health issues in the crop"""
        if not self.current_image_base64:
            return "❌ No image loaded. Call load_image() first."

        prompt = """You are an expert plant pathologist with 20 years experience.
        Examine this crop image VERY carefully for ANY signs of disease.
        Look at: leaf color, spots, lesions, wilting, discoloration, rot, mold.

        IMPORTANT: Even mild symptoms must be reported. Be specific.

        Answer STRICTLY in this format:
        Disease/Issue: <specific disease name — never say Unknown>
        Severity: <Mild/Moderate/Severe>
        Affected Parts: <leaves/stem/fruit/root>
        Symptoms Visible: <exactly what you see in the image>
        Cause: <Fungal/Bacterial/Viral/Pest/Deficiency>"""

        return self._ask_vision(prompt, self.current_image_base64)

    def get_crop_description(self) -> str:
        """Get detailed description and farming info about the crop"""
        if not self.current_image_base64:
            return "❌ No image loaded. Call load_image() first."

        prompt = """You are an expert agricultural scientist.
        Based on the crop in this image provide farming details.

        Answer STRICTLY in this format:
        Crop: <name>
        Growing Season: <months or Kharif/Rabi>
        Suitable Soil: <soil type>
        Water Requirement: <High/Medium/Low>
        Common Diseases: <list 3 diseases>
        Key Nutrients: <NPK requirements>
        Average Yield: <per acre>"""
        return self._ask_vision(prompt, self.current_image_base64)

    def get_treatment(self) -> str:
        """Get treatment advice for detected disease"""
        if not self.current_image_base64:
            return "❌ No image loaded. Call load_image() first."

        prompt = """You are an expert agricultural doctor.
        Look at this crop image carefully.
        Identify the disease and give precise treatment.

        Answer STRICTLY in this format:
        Problem Identified: <exact disease name>
        Immediate Action: <one specific action>
        Chemical Treatment: <specific product name and dosage>
        Organic Treatment: <specific natural remedy>
        Prevention: <one specific prevention tip>"""
        return self._ask_vision(prompt, self.current_image_base64)

    def analyze_image(self) -> dict:
        """
        Full analysis — runs all 4 checks at once.
        Returns dict with crop, disease, description, treatment.
        """
        if not self.current_image_base64:
            return {"error": "No image loaded. Call load_image() first."}

        print("\n🔍 Running full crop analysis...")
        print("   [1/4] Identifying crop...")
        crop = self.identify_crop()

        print("   [2/4] Detecting diseases...")
        disease = self.detect_disease()

        print("   [3/4] Getting crop description...")
        description = self.get_crop_description()

        print("   [4/4] Getting treatment advice...")
        treatment = self.get_treatment()

        print("   ✅ Analysis complete!\n")

        return {
            "image": self.current_image_path,
            "crop_identification": crop,
            "disease_detection": disease,
            "crop_description": description,
            "treatment_advice": treatment
        }

    def ask_about_image(self, question: str) -> str:
        """
        Ask any follow-up question about the loaded image.
        Example: "Is this disease contagious?"
                 "What fertilizer should I use?"
                 "How serious is this infection?"
        """
        if not self.current_image_base64:
            return "❌ No image loaded. Call load_image() first."

        if not question.strip():
            return "❌ Please provide a question."

        prompt = f"""You are an expert agricultural assistant.
Look at this crop image carefully and answer the following question accurately.

Question: {question}

Give a clear, practical answer focused on helping the farmer."""

        return self._ask_vision(prompt, self.current_image_base64)


# ──────────────────────────────────────────────
# QUICK TEST
# ──────────────────────────────────────────────

if __name__ == "__main__":
    analyzer = CropImageAnalyzer(model_name="llama3.2-vision")

    # Test with an image
    image_path = input("\nEnter image path to test: ").strip()

    if analyzer.load_image(image_path):
        result = analyzer.analyze_image()

        print("=" * 60)
        print("🌾 CROP IDENTIFICATION")
        print("=" * 60)
        print(result['crop_identification'])

        print("\n" + "=" * 60)
        print("🦠 DISEASE DETECTION")
        print("=" * 60)
        print(result['disease_detection'])

        print("\n" + "=" * 60)
        print("📋 CROP DESCRIPTION")
        print("=" * 60)
        print(result['crop_description'])

        print("\n" + "=" * 60)
        print("💊 TREATMENT ADVICE")
        print("=" * 60)
        print(result['treatment_advice'])