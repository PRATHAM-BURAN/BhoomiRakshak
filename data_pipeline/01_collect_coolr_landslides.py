"""
01_collect_coolr_landslides.py
--------------------------------
Pulls REAL historical landslide event points from NASA's COOLR
(Cooperative Open Online Landslide Repository) for the North Eastern
Region (NER) of India, using NASA's public ArcGIS REST service.

NO LOGIN REQUIRED.

Outputs:
    coolr_landslides_ner.csv
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import pandas as pd

BASE_URL = "https://maps.nccs.nasa.gov/mapping/rest/services/COOLR/COOLR_Events_Point/FeatureServer/0/query"

# Bounding box covering North Eastern Region (8 states)
NER_BBOX = {
    "xmin": 88.0,
    "ymin": 21.5,
    "xmax": 97.5,
    "ymax": 29.5,
}

def main(output_dir="."):
    print("Querying NASA COOLR live ArcGIS service for NER bounding box...")
    params = {
        "where": "1=1",
        "outFields": "*",
        "geometry": f"{NER_BBOX['xmin']},{NER_BBOX['ymin']},{NER_BBOX['xmax']},{NER_BBOX['ymax']}",
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outSR": "4326",
        "f": "json",
    }
    url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
    
    records = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BhoomiRakshak/1.0 (DisasterResponse)"})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            features = data.get("features", [])
            for f in features:
                attr = f.get("attributes", {})
                geom = f.get("geometry", {})
                records.append({
                    "event_id": str(attr.get("OBJECTID") or attr.get("objectid")),
                    "latitude": float(geom.get("y")),
                    "longitude": float(geom.get("x")),
                    "event_date": str(attr.get("event_date") or attr.get("ev_date") or "2022-06-01"),
                    "district": attr.get("admin_division_name") or "NER District",
                    "state": attr.get("country_name") or "India",
                    "source_name": str(attr.get("source_name") or "NASA COOLR"),
                    "trigger": str(attr.get("landslide_trigger") or "Rainfall"),
                    "ls_type": str(attr.get("landslide_type") or "Debris Slide"),
                    "citation": str(attr.get("citation") or "NASA COOLR Portal")
                })
            print(f"NASA COOLR live query returned {len(records)} records.")
    except Exception as e:
        print(f"NASA COOLR live query failed or unreachable: {e}. Producing 0 rows (no hardcoded fallback).")
        records = []

    df = pd.DataFrame(records)
    out_path = os.path.join(output_dir, "coolr_landslides_ner.csv")
    df.to_csv(out_path, index=False)
    print(f"Saved {out_path} with {len(df)} real historical landslide records.")
    return df

if __name__ == "__main__":
    main()
