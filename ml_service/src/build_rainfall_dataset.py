import os
import time
import pandas as pd
import xarray as xr
import earthaccess


INPUT_CSV = "data/processed/landslides_ner_dated.csv"
OUTPUT_CSV = "data/processed/landslides_ner_rainfall.csv"
GPM_DIR = "data/raw/gpm"

os.makedirs(GPM_DIR, exist_ok=True)


print("=" * 70)
print("LANDSLIDEAI - RESUMABLE GPM RAINFALL PIPELINE")
print("=" * 70)


# ------------------------------------------------------------
# LOAD DATA
# ------------------------------------------------------------

df = pd.read_csv(INPUT_CSV)

df["event_date"] = pd.to_datetime(df["event_date"])

print(f"Total events: {len(df)}")


# ------------------------------------------------------------
# LOAD PREVIOUS PROGRESS
# ------------------------------------------------------------

if os.path.exists(OUTPUT_CSV):

    print("\nExisting rainfall dataset found.")
    print("Loading previous progress...")

    old = pd.read_csv(OUTPUT_CSV)

    old["event_date"] = pd.to_datetime(old["event_date"])

    # Restore rainfall columns if present
    if "rainfall_1d" in old.columns:

        df = df.merge(
            old[
                [
                    "state",
                    "district",
                    "latitude",
                    "longitude",
                    "event_date",
                    "rainfall_1d",
                    "gpm_lat",
                    "gpm_lon"
                ]
            ],
            on=[
                "state",
                "district",
                "latitude",
                "longitude",
                "event_date"
            ],
            how="left"
        )

    print(
        "Already processed:",
        df["rainfall_1d"].notna().sum()
        if "rainfall_1d" in df.columns
        else 0
    )

else:

    print("\nNo previous rainfall dataset found.")

    df["rainfall_1d"] = None
    df["gpm_lat"] = None
    df["gpm_lon"] = None


# ------------------------------------------------------------
# NASA LOGIN
# ------------------------------------------------------------

print("\nLogging into NASA Earthdata...")

earthaccess.login()

print("Login successful.")


# ------------------------------------------------------------
# FIND EXISTING GPM FILE
# ------------------------------------------------------------

def get_existing_file(date):

    date_str = date.strftime("%Y%m%d")

    for filename in os.listdir(GPM_DIR):

        if date_str in filename and filename.endswith(".nc4"):

            return os.path.join(GPM_DIR, filename)

    return None


# ------------------------------------------------------------
# DOWNLOAD WITH RETRIES
# ------------------------------------------------------------

def download_gpm(date):

    existing = get_existing_file(date)

    if existing:

        print("Using existing file:", os.path.basename(existing))

        return existing


    for attempt in range(1, 4):

        try:

            print(
                f"Searching GPM for {date.date()} "
                f"(attempt {attempt}/3)..."
            )

            results = earthaccess.search_data(
                short_name="GPM_3IMERGDF",
                version="07",
                temporal=(
                    date.strftime("%Y-%m-%d"),
                    date.strftime("%Y-%m-%d")
                )
            )

            if not results:

                print("No GPM granule found.")

                return None


            print(f"Downloading GPM: {date.date()}")

            files = earthaccess.download(
                results[0],
                local_path=GPM_DIR
            )

            if files:

                return str(files[0])


        except Exception as e:

            print(
                f"Download error on attempt {attempt}:"
            )

            print(str(e)[:500])

            if attempt < 3:

                print("Waiting 10 seconds before retry...")
                time.sleep(10)


    print(
        f"FAILED: Could not download GPM for {date.date()}"
    )

    return None


# ------------------------------------------------------------
# EXTRACT RAINFALL
# ------------------------------------------------------------

def extract_rainfall(file_path, latitude, longitude):

    try:

        ds = xr.open_dataset(file_path)

        rainfall = ds["precipitation"].sel(
            lat=latitude,
            lon=longitude,
            method="nearest"
        )

        value = float(rainfall.values.squeeze())

        nearest_lat = float(rainfall.lat.values)
        nearest_lon = float(rainfall.lon.values)

        ds.close()

        return value, nearest_lat, nearest_lon

    except Exception as e:

        print("Extraction error:", e)

        return None, None, None


# ------------------------------------------------------------
# PROCESS EVENTS
# ------------------------------------------------------------

total = len(df)

for index, row in df.iterrows():

    # --------------------------------------------------------
    # Skip already processed event
    # --------------------------------------------------------

    if pd.notna(row["rainfall_1d"]):

        print(
            f"[{index + 1}/{total}] "
            f"Already processed"
        )

        continue


    event_date = row["event_date"]

    latitude = float(row["latitude"])
    longitude = float(row["longitude"])


    print("\n" + "-" * 70)

    print(
        f"[{index + 1}/{total}] "
        f"Date={event_date.date()} "
        f"Lat={latitude:.5f} "
        f"Lon={longitude:.5f}"
    )


    # --------------------------------------------------------
    # GET GPM
    # --------------------------------------------------------

    file_path = download_gpm(event_date)


    if file_path is None:

        print("Rainfall unavailable.")

        df.at[index, "rainfall_1d"] = None

        # Save progress even when failed
        df.to_csv(OUTPUT_CSV, index=False)

        continue


    # --------------------------------------------------------
    # EXTRACT
    # --------------------------------------------------------

    rainfall, gpm_lat, gpm_lon = extract_rainfall(
        file_path,
        latitude,
        longitude
    )


    df.at[index, "rainfall_1d"] = rainfall
    df.at[index, "gpm_lat"] = gpm_lat
    df.at[index, "gpm_lon"] = gpm_lon


    print(
        f"Rainfall: {rainfall} mm/day"
    )


    # --------------------------------------------------------
    # SAVE AFTER EVERY EVENT
    # --------------------------------------------------------

    df.to_csv(
        OUTPUT_CSV,
        index=False
    )

    print("Progress saved.")


# ------------------------------------------------------------
# FINAL REPORT
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("RAINFALL PIPELINE FINISHED")
print("=" * 70)

print(f"Output: {OUTPUT_CSV}")

print(
    f"Total events: {len(df)}"
)

print(
    f"Rainfall available: "
    f"{df['rainfall_1d'].notna().sum()}"
)

print(
    f"Rainfall missing: "
    f"{df['rainfall_1d'].isna().sum()}"
)

print("\nRainfall statistics:")

print(
    df["rainfall_1d"].describe()
)