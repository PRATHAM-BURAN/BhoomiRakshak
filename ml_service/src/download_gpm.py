import os
import pandas as pd
import earthaccess

INPUT_FILE = "data/processed/landslides_ner_dated.csv"
OUTPUT_DIR = "data/raw/gpm"

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Loading landslide dataset...")

df = pd.read_csv(INPUT_FILE)

df["event_date"] = pd.to_datetime(df["event_date"])

dates = sorted(df["event_date"].dt.strftime("%Y-%m-%d").unique())

print(f"Total landslide events: {len(df)}")
print(f"Unique dates required: {len(dates)}")

print("\nLogging into NASA Earthdata...")

earthaccess.login()

print("NASA login successful.")

for index, date in enumerate(dates, start=1):

    print(f"\n[{index}/{len(dates)}] Searching: {date}")

    results = earthaccess.search_data(
        short_name="GPM_3IMERGDF",
        version="07",
        temporal=(date, date),
        count=10
    )

    if not results:
        print("  No GPM file found.")
        continue

    output_file = os.path.join(
        OUTPUT_DIR,
        f"GPM_{date}.nc4"
    )

    if os.path.exists(output_file):
        print("  Already downloaded.")
        continue

    print("  Downloading...")

    downloaded = earthaccess.download(
        results[0],
        local_path=OUTPUT_DIR
    )

    if downloaded:
        actual_file = downloaded[0]

        # Rename to our simple naming convention
        if os.path.exists(actual_file):
            os.replace(actual_file, output_file)

        print(f"  Saved: {output_file}")

print("\n================================")
print("GPM DOWNLOAD COMPLETE")
print("================================")