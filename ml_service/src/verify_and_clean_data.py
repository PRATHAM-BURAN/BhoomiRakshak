"""
verify_and_clean_data.py
------------------------
Automated data profiling, cleaning, and quality audit for the Geological Survey of
India (GSI) / NLSM North Eastern Region Landslide Inventory.

Data Cleaning Rules:
1. Fix coordinate sign typos (e.g. -23.736217 -> +23.736217 in Aizawl, Mizoram).
2. Validate spatial bounding box (NER bounds: Lat 21.0 - 29.8, Lon 88.0 - 97.8).
3. Standardize material names into canonical classes: Debris, Earth/Soil, Rock, Rock-cum-Debris.
4. Standardize movement types into canonical classes: Slide, Flow, Fall, Complex, Subsidence, Creep.
5. Standardize event dates into ISO format (YYYY-MM-DD) for dated records, preserve all 11,000+ records in full inventory.
6. Fill missing slide names with descriptive geographic identifiers.
7. Deduplicate records.
"""

import os
import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
INPUT_FULL = os.path.join(DATA_DIR, "landslides_ner.csv")
INPUT_DATED = os.path.join(DATA_DIR, "landslides_ner_dated.csv")

NER_BOUNDS = {
    "lat_min": 21.0,
    "lat_max": 29.8,
    "lon_min": 88.0,
    "lon_max": 97.8
}

def clean_movement_type(val):
    if pd.isna(val) or not str(val).strip():
        return "Slide"
    s = str(val).lower().strip()
    if "fall" in s or "topple" in s:
        return "Fall"
    if "flow" in s:
        return "Flow"
    if "subsidence" in s:
        return "Subsidence"
    if "creep" in s:
        return "Creep"
    if "complex" in s or "multiple" in s or "slide and flow" in s:
        return "Complex"
    if "slide" in s or "rotational" in s or "translational" in s:
        return "Slide"
    return "Slide"

def clean_material(val):
    if pd.isna(val) or not str(val).strip():
        return "Debris"
    s = str(val).lower().strip()
    if "rock" in s and "debris" in s:
        return "Rock-cum-Debris"
    if "rock" in s or "quartzite" in s:
        return "Rock"
    if "earth" in s or "soil" in s or "sandy" in s or "regolith" in s:
        return "Earth/Soil"
    if "debris" in s:
        return "Debris"
    return "Debris"

def clean_dataset(input_path, is_dated=False):
    print(f"\n=======================================================")
    print(f"CLEANING & AUDITING: {os.path.basename(input_path)} (dated_only={is_dated})")
    print(f"=======================================================")
    
    df = pd.read_csv(input_path)
    initial_rows = len(df)
    print(f"Initial raw record count: {initial_rows}")

    # 1. Coordinate Cleaning
    neg_lats = df["latitude"] < 0
    if neg_lats.sum() > 0:
        print(f">> Corrected {neg_lats.sum()} negative latitude typo(s) to positive (NER coordinates).")
        df.loc[neg_lats, "latitude"] = df.loc[neg_lats, "latitude"].abs()

    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

    # Spatial bounds check
    in_bounds = (
        (df["latitude"] >= NER_BOUNDS["lat_min"]) & 
        (df["latitude"] <= NER_BOUNDS["lat_max"]) & 
        (df["longitude"] >= NER_BOUNDS["lon_min"]) & 
        (df["longitude"] <= NER_BOUNDS["lon_max"])
    )
    out_of_bounds = (~in_bounds).sum()
    if out_of_bounds > 0:
        print(f">> Removing {out_of_bounds} record(s) strictly outside NER geographic bounding box.")
        df = df[in_bounds].copy()

    # 2. State & District Cleaning
    df["state"] = df["state"].astype(str).str.strip()
    df["district"] = df["district"].fillna("Unknown Sector").astype(str).str.strip()
    
    # 3. Categorical Standardization
    df["movement_type"] = df["movement_type"].apply(clean_movement_type)
    df["material"] = df["material"].apply(clean_material)

    # 4. Slide Name standardization
    for idx, row in df.iterrows():
        if pd.isna(row.get("slide_name")) or not str(row.get("slide_name")).strip():
            district_name = row.get("district", "NER")
            slide_no = row.get("slide_no", idx)
            df.at[idx, "slide_name"] = f"{district_name} Slope Movement ({slide_no})"
        else:
            df.at[idx, "slide_name"] = str(row["slide_name"]).strip()

    # 5. Date Standardization
    if is_dated:
        df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
        valid_dates = df["event_date"].notna()
        if (~valid_dates).sum() > 0:
            print(f">> Filtered out {(~valid_dates).sum()} record(s) with invalid dates.")
            df = df[valid_dates].copy()
        df["event_date"] = df["event_date"].dt.strftime("%Y-%m-%d")
    else:
        # For full inventory, standardize format where available, leave blank where undated
        parsed_dates = pd.to_datetime(df["event_date"], errors="coerce")
        df["event_date"] = parsed_dates.dt.strftime("%Y-%m-%d").fillna("")

    # 6. Deduplication
    before_dedup = len(df)
    subset_cols = ["slide_no", "latitude", "longitude"]
    df = df.drop_duplicates(subset=subset_cols).copy()
    print(f">> Deduplication: removed {before_dedup - len(df)} duplicate records.")

    # 7. Add binary target label
    df["label"] = 1
    df["landslide"] = 1

    # Final stats
    print(f"Final certified clean record count: {len(df)}")
    print("\nState Distribution:")
    print(df["state"].value_counts())
    print("\nMovement Type Distribution:")
    print(df["movement_type"].value_counts())
    print("\nMaterial Distribution:")
    print(df["material"].value_counts())

    # Save cleaned file
    df.to_csv(input_path, index=False, encoding="utf-8")
    print(f"Saved certified clean dataset to: {input_path}")
    return df

if __name__ == "__main__":
    clean_full = clean_dataset(INPUT_FULL, is_dated=False)
    clean_dated = clean_dataset(INPUT_DATED, is_dated=True)
    print("\nBoth datasets verified, cleaned, and certified.")
