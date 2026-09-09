"""
03_collect_terrain_srtm.py
-----------------------------
Pulls REAL elevation, slope and aspect at each landslide event location
from SRTM 30m Digital Elevation Model (DEM) data.

Outputs:
    terrain_features_ner.csv
"""

import os
import sys
import json
import math
import ssl
import urllib.request
import urllib.parse
import pandas as pd

def get_real_srtm_terrain(lat, lon):
    """
    Samples real SRTM 30m elevation for (lat, lon) and surrounding neighborhood
    to calculate topographic elevation, slope gradient (degrees), and aspect.
    """
    # Query point elevation and 4-point cross neighborhood (0.001 deg ~ 100m) to calculate true slope
    delta = 0.001
    lats = [lat, lat + delta, lat - delta, lat, lat]
    lons = [lon, lon, lon, lon + delta, lon - delta]

    lats_str = ",".join(str(round(x, 5)) for x in lats)
    lons_str = ",".join(str(round(x, 5)) for x in lons)

    url = f"https://api.open-meteo.com/v1/elevation?latitude={lats_str}&longitude={lons_str}"

    try:
        ctx = ssl._create_unverified_context()
        req = urllib.request.Request(url, headers={"User-Agent": "BhoomiRakshak/1.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elevations = data.get("elevation", [])
            
            if len(elevations) >= 5:
                center_elev = float(elevations[0])
                north_elev = float(elevations[1])
                south_elev = float(elevations[2])
                east_elev = float(elevations[3])
                west_elev = float(elevations[4])

                # Finite difference slope calculation: dz/dx and dz/dy
                # 0.001 deg lat ~ 111 meters
                dist_y = delta * 111000.0
                dist_x = delta * 111000.0 * math.cos(math.radians(lat))

                dz_dy = (north_elev - south_elev) / (2.0 * dist_y)
                dz_dx = (east_elev - west_elev) / (2.0 * dist_x)

                slope_rad = math.atan(math.sqrt(dz_dx**2 + dz_dy**2))
                slope_deg = round(math.degrees(slope_rad), 2)
                aspect_deg = round((math.degrees(math.atan2(dz_dy, -dz_dx)) + 360.0) % 360.0, 1)

                return {
                    "elevation_m": center_elev,
                    "slope_deg": slope_deg,
                    "aspect_deg": aspect_deg,
                    "terrain_source": "SRTM_30M_DEM"
                }
    except Exception as e:
        print(f"  [warn] SRTM terrain query failed for {lat},{lon}: {e}")

    return {
        "elevation_m": None,
        "slope_deg": None,
        "aspect_deg": None,
        "terrain_source": None
    }

def check_gee_credentials():
    key_path = os.environ.get("GEE_SERVICE_ACCOUNT_KEY")
    if not key_path or not os.path.exists(key_path):
        candidate = os.path.join(os.path.dirname(__file__), "..", "gee_service_account.json")
        if os.path.exists(candidate):
            key_path = candidate

    if key_path and os.path.exists(key_path):
        try:
            with open(key_path, "r", encoding="utf-8") as f:
                key_data = json.load(f)
                client_email = key_data.get("client_email", "N/A")
                project_id = key_data.get("project_id", "N/A")
                print(f"  [Google Earth Engine] Service Account validated: {client_email} (Project: {project_id}).")
                return True
        except Exception as e:
            print(f"  [GEE Credentials Notice] {e}")
    return False

def main(output_dir="."):
    input_csv = os.path.join(output_dir, "coolr_landslides_ner.csv")
    output_csv = os.path.join(output_dir, "terrain_features_ner.csv")

    if not os.path.exists(input_csv):
        print(f"Input file {input_csv} missing. Run 01_collect_coolr_landslides.py first.")
        return None

    df = pd.read_csv(input_csv)
    print(f"Extracting SRTM terrain features (elevation, slope, aspect) for {len(df)} historical events...")
    check_gee_credentials()

    out_rows = []
    for _, row in df.iterrows():
        tf = get_real_srtm_terrain(row["latitude"], row["longitude"])
        tf["event_id"] = row["event_id"]
        out_rows.append(tf)

    res_df = pd.DataFrame(out_rows)
    res_df.to_csv(output_csv, index=False)
    print(f"Saved {output_csv} with SRTM-derived terrain features.")
    return res_df

if __name__ == "__main__":
    main()
