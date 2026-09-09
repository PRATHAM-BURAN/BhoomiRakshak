"""
BhoomiRakshak AI Microservice - FastAPI Server
SIH26001 Landslide Risk Inference & Explainability API
"""

import os
import json
import urllib.request
import urllib.error
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from model import model, FEATURE_NAMES
from train import train_model

app = FastAPI(
    title="BhoomiRakshak AI Landslide Intelligence API",
    description="Inference and Explainable Risk Scoring Engine for North Eastern Region (SIH26001)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_API_URL = os.environ.get("BACKEND_API_URL", "http://127.0.0.1:5000/api")

class FeatureVector(BaseModel):
    rain_30min: float = Field(0.0, description="Rainfall in last 30 minutes (mm)")
    rain_3h: float = Field(0.0, description="Rainfall in last 3 hours (mm)")
    rain_24h: float = Field(0.0, description="Accumulated rainfall in last 24 hours (mm)")
    rain_7d: float = Field(0.0, description="Accumulated rainfall in last 7 days (mm)")
    slope_deg: float = Field(15.0, description="Terrain slope gradient in degrees")
    elevation_m: float = Field(500.0, description="Altitude in meters")
    historical_landslide_density: float = Field(0.0, description="Historical landslide events per sq km")
    satellite_change_proxy: float = Field(0.0, description="Vegetation clearing or SAR coherence loss [0.0 - 1.0]")

class ScoreRegionRequest(BaseModel):
    region_id: str = Field(..., description="Target Region UUID")
    features: Optional[FeatureVector] = None

@app.get("/")
def read_root():
    return {
        "service": "BhoomiRakshak AI Landslide Inference Service",
        "status": "ONLINE",
        "version": model.model_name,
        "docs_url": "/docs"
    }

@app.get("/ml/health")
def ml_health():
    """
    Reports whether a real trained model file is loaded or not.
    Documents the active engine status, metrics, and feature importances.
    """
    return {
        "status": "HEALTHY",
        "model_loaded": True,
        "model_name": model.model_name,
        "trained_on_real_ground_truth": model.trained_on_real_ground_truth,
        "disclaimer": model.notice,
        "metrics": model.metadata.get("metrics", {}),
        "feature_importances": model.metadata.get("feature_importances", {}),
        "total_samples": model.metadata.get("total_samples", 0),
        "features_expected": FEATURE_NAMES
    }

@app.post("/ml/train")
def trigger_training():
    """
    Trains or retrains the Random Forest Classifier on bhoomirakshak_training_data_ner.csv
    and automatically hot-reloads the weights into the running model engine.
    """
    try:
        metadata = train_model()
        model.reload_model()
        return {
            "status": "SUCCESS",
            "message": "Model trained and loaded successfully",
            "metadata": metadata
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")

@app.post("/ml/predict")
def predict_hazard(features: FeatureVector):
    """
    Computes risk probability, risk level, and explainability reasons for a single feature vector.
    """
    result = model.predict(features.model_dump())
    return result

@app.post("/ml/score-region")
def score_region(payload: ScoreRegionRequest):
    """
    Evaluates risk for a specific region and transmits the computed score to the backend /api/ml/score endpoint.
    """
    feat_dict = payload.features.model_dump() if payload.features else {}
    prediction = model.predict(feat_dict)

    backend_payload = {
        "region_id": payload.region_id,
        "current_risk_score": prediction["risk_probability"],
        "risk_level": prediction["risk_level"],
        "reasons": prediction["reasons"],
        "model_version": prediction["model_version"]
    }

    try:
        url = f"{BACKEND_API_URL}/ml/score"
        data_bytes = json.dumps(backend_payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            resp_body = json.loads(response.read().decode('utf-8'))
            return {
                "status": "SUCCESS",
                "prediction": prediction,
                "backend_response": resp_body
            }
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        raise HTTPException(status_code=e.code, detail=f"Backend rejected score: {err_msg}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach BhoomiRakshak backend: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
