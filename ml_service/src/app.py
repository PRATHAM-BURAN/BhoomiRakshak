from fastapi import FastAPI
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from datetime import datetime

# --------------------------------------------------
# APP
# --------------------------------------------------

app = FastAPI(
    title="LandslideAI ML Service",
    description="AI-powered landslide risk prediction service with XGBoost (SIH26001)",
    version="1.0.0"
)

# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "landslide_xgb_model.pkl"
DATA_PATH = BASE_DIR / "data" / "processed" / "landslides_ner.csv"

# --------------------------------------------------
# LOAD MODEL
# --------------------------------------------------

model = None
if MODEL_PATH.exists():
    model = joblib.load(MODEL_PATH)
    print(f"Landslide XGBoost model loaded successfully from {MODEL_PATH}.")
else:
    print(f"Warning: Model not found at {MODEL_PATH}. Please run train_model.py first.")

# --------------------------------------------------
# LOAD HISTORICAL DATA
# --------------------------------------------------

historical_df = None
if DATA_PATH.exists():
    historical_df = pd.read_csv(DATA_PATH)
    historical_df = historical_df.dropna(subset=["latitude", "longitude"]).copy()
    print(f"Historical GSI landslide records loaded: {len(historical_df)}")
else:
    print(f"Warning: Historical data not found at {DATA_PATH}")

# --------------------------------------------------
# REQUEST SCHEMA
# --------------------------------------------------

class PredictionRequest(BaseModel):
    latitude: float
    longitude: float
    rainfall_1d: float = Field(..., description="Rainfall in 24 hours (mm)")
    event_date: str = Field(..., description="Date formatted as YYYY-MM-DD")
    slope_deg: float = Field(20.0, description="Terrain slope gradient (degrees)")
    elevation_m: float = Field(800.0, description="Altitude (meters)")
    rain_7d: float = Field(45.0, description="7-day accumulated rainfall (mm)")
    rain_3h: float = Field(15.0, description="3-hour rainfall (mm)")
    satellite_change_proxy: float = Field(0.25, description="Surface disturbance index [0.0 - 1.0]")

# --------------------------------------------------
# HISTORICAL EVENT DENSITY
# --------------------------------------------------

def calculate_historical_density(latitude, longitude):
    if historical_df is None or len(historical_df) == 0:
        return 0.0

    lat_grid = round(float(latitude), 1)
    lon_grid = round(float(longitude), 1)

    hist_lat = np.round(historical_df["latitude"].values, 1)
    hist_lon = np.round(historical_df["longitude"].values, 1)

    matches = ((hist_lat == lat_grid) & (hist_lon == lon_grid)).sum()
    return float(round(matches / 1.2, 2))

# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "LandslideAI ML Service",
        "status": "running",
        "model": "XGBoost Classifier v2.0",
        "historical_records_indexed": len(historical_df) if historical_df is not None else 0
    }

# --------------------------------------------------
# PREDICTION
# --------------------------------------------------

@app.post("/predict")
def predict(request: PredictionRequest):
    try:
        date = datetime.strptime(request.event_date, "%Y-%m-%d")
    except ValueError:
        date = datetime.now()

    month = date.month
    day_of_year = date.timetuple().tm_yday

    # Calculate empirical spatial hazard density from 11,001 GSI points
    density = calculate_historical_density(request.latitude, request.longitude)

    # Prepare features matching XGBoost training schema
    features = pd.DataFrame([{
        "latitude": request.latitude,
        "longitude": request.longitude,
        "slope_deg": request.slope_deg,
        "elevation_m": request.elevation_m,
        "rain_24h": request.rainfall_1d,
        "rain_7d": request.rain_7d,
        "rain_3h": request.rain_3h,
        "historical_landslide_density": density,
        "satellite_change_proxy": request.satellite_change_proxy,
        "month": month,
        "day_of_year": day_of_year
    }])

    if model is not None:
        probability = float(model.predict_proba(features)[0][1])
    else:
        # Heuristic fallback
        probability = 0.5

    risk_score = round(probability * 100, 1)

    if risk_score >= 70:
        risk_level = "HIGH"
    elif risk_score >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    prediction = int(risk_score >= 50)

    return {
        "prediction": prediction,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "probability": round(probability, 4),
        "historical_landslide_density": density,
        "features_evaluated": features.to_dict(orient="records")[0]
    }