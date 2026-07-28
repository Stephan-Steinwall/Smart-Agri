import os
import joblib
import pandas as pd
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

MODEL_FILE = os.getenv("MODEL_FILE", "models/crop_reference_model.joblib")
ALLOWED_ORIGINS_STR = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5500,http://127.0.0.1:3000"
)
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS_STR.split(",") if origin.strip()]

app = FastAPI(
    title="AgriBot Portable Wireless Soil Sensor - Crop Recommendation API",
    description="FastAPI service for evaluating portable soil sensor readings against an agronomic reference model.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model container
model_package: Dict[str, Any] = {}

def load_model():
    global model_package
    if os.path.exists(MODEL_FILE):
        try:
            model_package = joblib.load(MODEL_FILE)
            print(f"Successfully loaded model package from '{MODEL_FILE}'.")
        except Exception as e:
            print(f"Error loading model from '{MODEL_FILE}': {str(e)}")
            model_package = {}
    else:
        print(f"Warning: Model file '{MODEL_FILE}' not found. Please run 'train_model.py' first.")

load_model()

class EvaluateRequest(BaseModel):
    selected_crop: str = Field(..., description="Crop name selected by the farmer")
    soil_ph: float = Field(..., ge=0.0, le=14.0, description="Soil pH reading (0-14)")
    temperature_c: float = Field(..., ge=-20.0, le=60.0, description="Soil temperature in Celsius")
    soil_conductivity_dsm: float = Field(..., ge=0.0, description="Electrical conductivity in dS/m")
    moisture_paw_percent: float = Field(..., ge=0.0, le=100.0, description="Plant available water percentage (0-100)")

class CropRecommendationScore(BaseModel):
    crop: str
    reference_score: float

class EvaluateResponse(BaseModel):
    selected_crop: str
    selected_crop_reference_score: float
    decision: str
    decision_message: str
    recommended_crop: str
    recommended_crop_reference_score: float
    top_recommendations: List[CropRecommendationScore]
    model_version: str
    training_origin: str
    warning: str

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Check API health and model loading status.
    """
    is_loaded = "model" in model_package and model_package["model"] is not None
    classes = model_package.get("classes", []) if is_loaded else []
    version = model_package.get("model_version", "unknown") if is_loaded else "unavailable"
    
    return {
        "status": "healthy" if is_loaded else "degraded",
        "model_loaded": is_loaded,
        "model_version": version,
        "supported_crops": classes,
        "service": "Portable Wireless Soil Sensor Recommendation Module"
    }

@app.post("/evaluate", response_model=EvaluateResponse, tags=["Evaluation"])
async def evaluate_soil(request: EvaluateRequest):
    """
    Evaluate soil conditions against the reference model for a selected crop.
    Returns reference model scores and recommendation decisions.
    """
    if "model" not in model_package or model_package["model"] is None:
        # Try reloading in case model was just trained
        load_model()
        if "model" not in model_package or model_package["model"] is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Agronomic reference model is not loaded or trained yet. Please train the model."
            )

    model = model_package["model"]
    features = model_package["features"]
    classes = model_package["classes"]
    model_version = model_package.get("model_version", "reference_rf_v1")
    training_origin = model_package.get("training_origin", "reference_generated")
    warning_msg = model_package.get("warning", "PROTOTYPE WARNING: Trained from generated agronomic ranges.")

    if request.selected_crop not in classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Selected crop '{request.selected_crop}' is not supported by the reference model. Supported crops are: {', '.join(classes)}"
        )

    try:
        # Prepare feature DataFrame with correct column names and order
        input_data = pd.DataFrame([{
            "soil_ph": request.soil_ph,
            "temperature_c": request.temperature_c,
            "soil_conductivity_dsm": request.soil_conductivity_dsm,
            "moisture_paw_percent": request.moisture_paw_percent
        }])[features]

        # Get class probabilities
        probas = model.predict_proba(input_data)[0]
        
        # Build score list (probabilities scaled to 0-100 reference scores)
        scores = []
        for crop_name, prob in zip(classes, probas):
            score_val = round(float(prob) * 100.0, 1)
            scores.append({"crop": crop_name, "reference_score": score_val})

        # Sort descending by reference score
        scores.sort(key=lambda x: x["reference_score"], reverse=True)

        # Find selected crop score
        selected_score = 0.0
        for item in scores:
            if item["crop"] == request.selected_crop:
                selected_score = item["reference_score"]
                break

        # Get top 3 recommendations
        top_3 = [CropRecommendationScore(**item) for item in scores[:3]]
        best_crop = top_3[0].crop
        best_score = top_3[0].reference_score

        # Prototype application thresholds
        if selected_score >= 60.0:
            decision = "Recommended by reference model"
            decision_msg = f"The agronomic reference model indicates that {request.selected_crop} is recommended for this soil profile (Score: {selected_score}/100)."
        elif selected_score >= 35.0:
            decision = "Possible with caution"
            decision_msg = f"The agronomic reference model indicates that {request.selected_crop} is possible with caution (Score: {selected_score}/100). Monitor soil conditions and drainage closely."
        else:
            decision = "Not recommended by reference model"
            decision_msg = f"The agronomic reference model does not recommend {request.selected_crop} for this soil profile (Score: {selected_score}/100). Consider alternative crops like {best_crop}."

        return EvaluateResponse(
            selected_crop=request.selected_crop,
            selected_crop_reference_score=selected_score,
            decision=decision,
            decision_message=decision_msg,
            recommended_crop=best_crop,
            recommended_crop_reference_score=best_score,
            top_recommendations=top_3,
            model_version=model_version,
            training_origin=training_origin,
            warning=warning_msg
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during soil evaluation: {str(e)}"
        )
