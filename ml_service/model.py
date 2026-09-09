"""
BhoomiRakshak AI Risk Engine - Machine Learning & Geospatial Telemetry Model
SIH26001: Landslide Early Warning & Risk Monitoring in North Eastern Region

Integrates:
  1. NASA COOLR Landslide Inventory ground truth
  2. NASA GPM IMERG / ERA5 Precipitation accumulation windows (24h, 72h, 7d)
  3. SRTM 30m Digital Elevation Model (slope, aspect, elevation)
  4. Geospatial vulnerability index (historical cluster density & satellite disturbance)
"""

import os
import json
import math
import joblib
import numpy as np

ML_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(ML_DIR, "bhoomirakshak_model.joblib")
METADATA_FILE = os.path.join(ML_DIR, "model_metadata.json")

FEATURE_NAMES = [
    'rain_30min',                   # Short-duration cloudburst intensity (mm)
    'rain_3h',                      # Short-term accumulation (mm)
    'rain_24h',                     # Daily deluge volume (mm)
    'rain_7d',                      # Antecedent moisture / pore pressure (mm)
    'slope_deg',                    # Slope gradient (degrees)
    'elevation_m',                  # Altitude (meters above sea level)
    'historical_landslide_density', # Events per sq km
    'satellite_change_proxy'        # Optical NDVI loss or SAR coherence loss (0.0 to 1.0)
]

class LandslideRiskEngine:
    def __init__(self):
        self.rf_model = None
        self.metadata = {}
        self.reload_model()

    def reload_model(self):
        """Loads or reloads the trained Random Forest model if available on disk."""
        if os.path.exists(MODEL_FILE) and os.path.exists(METADATA_FILE):
            try:
                self.rf_model = joblib.load(MODEL_FILE)
                with open(METADATA_FILE, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                self.model_name = self.metadata.get("model_name", "BhoomiRakshak-NER-RandomForest-v2.0")
                self.trained_on_real_ground_truth = True
                self.notice = f"Trained on genuine ground truth ({self.metadata.get('dataset_source')}) - {self.metadata.get('total_samples')} verified samples."
                print(f"[ENGINE] Successfully loaded trained model: {self.model_name}")
                return True
            except Exception as e:
                print(f"[ENGINE WARN] Error loading model file: {e}")
        
        self.rf_model = None
        self.metadata = {}
        self.model_name = "BhoomiRakshak-NER-Baseline-v1.0"
        self.trained_on_real_ground_truth = False
        self.notice = "Baseline model — execute data pipeline and retrain on real NASA COOLR/GPM/SRTM data."
        return False

    def predict(self, features: dict):
        """
        Accepts dictionary of telemetry & geotechnical parameters and computes:
          - risk_probability: float [0.0, 1.0]
          - risk_level: str ('SAFE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL')
          - reasons: list of top explainable contributing factors
          - factor_contributions: dict of individual weights
        """
        r30 = float(features.get('rain_30min', 0.0))
        r3h = float(features.get('rain_3h', 0.0))
        r24 = float(features.get('rain_24h', 0.0))
        r7d = float(features.get('rain_7d', 0.0))
        slope = float(features.get('slope_deg', 15.0))
        elev = float(features.get('elevation_m', 500.0))
        density = float(features.get('historical_landslide_density', 0.0))
        sat_change = float(features.get('satellite_change_proxy', 0.0))

        feature_vector = [r30, r3h, r24, r7d, slope, elev, density, sat_change]

        if self.rf_model is not None:
            # Use trained Random Forest inference
            proba = self.rf_model.predict_proba([feature_vector])[0]
            probability = float(round(proba[1], 4))
        else:
            # Fallback baseline physics model
            rain_score = 0.0
            if r24 > 150 or r3h > 65:
                rain_score += 0.45
            elif r24 > 90 or r3h > 35:
                rain_score += 0.28
            elif r24 > 45 or r3h > 15:
                rain_score += 0.14

            if r7d > 300:
                rain_score += 0.25
            elif r7d > 180:
                rain_score += 0.15
            elif r7d > 90:
                rain_score += 0.08

            terrain_score = 0.0
            if slope >= 38:
                terrain_score += 0.35
            elif slope >= 28:
                terrain_score += 0.22
            elif slope >= 18:
                terrain_score += 0.10
            else:
                terrain_score += 0.02

            vulnerability_score = 0.0
            if density > 3.0:
                vulnerability_score += 0.20
            elif density > 1.0:
                vulnerability_score += 0.10

            if sat_change > 0.6:
                vulnerability_score += 0.15
            elif sat_change > 0.3:
                vulnerability_score += 0.08

            raw_prob = rain_score * 0.45 + terrain_score * 0.35 + vulnerability_score * 0.20
            if r24 > 120 and slope > 30:
                raw_prob = min(1.0, raw_prob * 1.35)
            probability = float(max(0.0, min(1.0, round(raw_prob, 4))))

        # Classify hazard tier mapped to NDMA/IMD standard 5 tiers
        if probability >= 0.80:
            risk_level = "CRITICAL"
        elif probability >= 0.60:
            risk_level = "HIGH"
        elif probability >= 0.38:
            risk_level = "MODERATE"
        elif probability >= 0.18:
            risk_level = "LOW"
        else:
            risk_level = "SAFE"

        # Explainable AI: Feature contributions and physical narrative
        reasons = []
        contributions = {}

        # Feature contributions based on importances or empirical weights
        importances = self.metadata.get("feature_importances", {
            "rain_24h": 0.35,
            "rain_7d": 0.25,
            "slope_deg": 0.20,
            "rain_3h": 0.10,
            "historical_landslide_density": 0.05,
            "satellite_change_proxy": 0.03,
            "elevation_m": 0.01,
            "rain_30min": 0.01
        })

        if r24 >= 100:
            reasons.append(f"Extreme 24h precipitation ({r24:.1f} mm) exceeds regional debris flow threshold")
            contributions['rain_24h'] = round(importances.get('rain_24h', 0.35), 3)
        elif r24 >= 45:
            reasons.append(f"Elevated 24h rainfall ({r24:.1f} mm) inducing sub-surface saturation")
            contributions['rain_24h'] = round(importances.get('rain_24h', 0.25) * 0.7, 3)

        if r7d >= 180:
            reasons.append(f"High 7-day antecedent rainfall ({r7d:.1f} mm) indicates elevated pore-water pressure")
            contributions['rain_7d'] = round(importances.get('rain_7d', 0.25), 3)

        if slope >= 30:
            reasons.append(f"Steep slope gradient ({slope:.1f}°) promotes gravitational shear failure")
            contributions['slope'] = round(importances.get('slope_deg', 0.25), 3)
        elif slope >= 18:
            reasons.append(f"Moderate terrain slope ({slope:.1f}°) vulnerable under monsoon saturation")
            contributions['slope'] = round(importances.get('slope_deg', 0.15) * 0.6, 3)

        if sat_change >= 0.35:
            reasons.append(f"Satellite spectral change detected (index: {sat_change:.2f}) indicating slope deformation or clearing")
            contributions['satellite_change'] = round(importances.get('satellite_change_proxy', 0.1), 3)

        if density >= 1.0:
            reasons.append(f"Historical landslide cluster in sector ({density:.1f} events/km²)")
            contributions['historical_density'] = round(importances.get('historical_landslide_density', 0.1), 3)

        if not reasons:
            reasons.append("Environmental parameters within stable baseline thresholds")
            contributions['baseline_stability'] = 1.0

        return {
            "model_version": self.model_name,
            "risk_probability": probability,
            "risk_level": risk_level,
            "reasons": reasons,
            "contributions": contributions,
            "is_trained_ground_truth": self.trained_on_real_ground_truth,
            "metrics": self.metadata.get("metrics", {}),
            "caveat": self.notice
        }

model = LandslideRiskEngine()
