import pandas as pd
import os

INPUT_FILE = "data/processed/landslides_raw.csv"
OUTPUT_FILE = "data/processed/landslides_ner.csv"
DATED_OUTPUT_FILE = "data/processed/landslides_ner_dated.csv"

# --------------------------------------------------
# 1. Column names from the GSI PDF
# --------------------------------------------------

columns = [
    "sl_no",
    "slide_no",
    "state",
    "district",
    "slide_name",
    "nh_sh_location",
    "latitude",
    "longitude",
    "material",
    "movement_type",
    "history"
]

# --------------------------------------------------
# 2. Read raw extracted CSV
# --------------------------------------------------

print("Loading raw dataset...")

df = pd.read_csv(
    INPUT_FILE,
    header=None,
    names=columns,
    dtype=str
)

print(f"Raw rows: {len(df)}")

# --------------------------------------------------
# 3. Remove PDF title/header rows
# --------------------------------------------------

df["state"] = df["state"].astype(str).str.strip()

ner_states = {
    "Arunachal Pradesh",
    "Assam",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Sikkim",
    "Tripura"
}

df = df[df["state"].isin(ner_states)].copy()

print(f"Rows after NER filtering: {len(df)}")

# --------------------------------------------------
# 4. Clean text columns
# --------------------------------------------------

text_columns = [
    "slide_no",
    "state",
    "district",
    "slide_name",
    "nh_sh_location",
    "material",
    "movement_type",
    "history"
]

for col in text_columns:
    df[col] = (
        df[col]
        .fillna("")
        .astype(str)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )

# --------------------------------------------------
# 5. Convert latitude and longitude to numbers
# --------------------------------------------------

df["latitude"] = pd.to_numeric(
    df["latitude"],
    errors="coerce"
)

df["longitude"] = pd.to_numeric(
    df["longitude"],
    errors="coerce"
)

# --------------------------------------------------
# 6. Remove invalid coordinates
# --------------------------------------------------

before_coordinates = len(df)

df = df[
    df["latitude"].between(-90, 90)
    & df["longitude"].between(-180, 180)
].copy()

print(
    f"Removed invalid coordinates: "
    f"{before_coordinates - len(df)}"
)

# --------------------------------------------------
# 7. Remove duplicate landslide records
# --------------------------------------------------

before_duplicates = len(df)

df = df.drop_duplicates(
    subset=["slide_no", "latitude", "longitude"]
)

print(
    f"Removed duplicates: "
    f"{before_duplicates - len(df)}"
)

# --------------------------------------------------
# 8. Create standardized event date
# --------------------------------------------------

# History contains values such as:
# 17 May 2016
# 18 May 2016
# NA / blank

df["event_date"] = pd.to_datetime(
    df["history"],
    errors="coerce",
    dayfirst=True
)

# --------------------------------------------------
# 9. Add ML label
# --------------------------------------------------

# Every record in this inventory represents
# an observed landslide.

df["landslide"] = 1

# --------------------------------------------------
# 10. Select final columns
# --------------------------------------------------

final_columns = [
    "slide_no",
    "state",
    "district",
    "slide_name",
    "nh_sh_location",
    "latitude",
    "longitude",
    "material",
    "movement_type",
    "history",
    "event_date",
    "landslide"
]

df = df[final_columns]

# --------------------------------------------------
# 11. Save complete NER inventory
# --------------------------------------------------

os.makedirs("data/processed", exist_ok=True)

df.to_csv(
    OUTPUT_FILE,
    index=False,
    encoding="utf-8"
)

# --------------------------------------------------
# 12. Save only records with known dates
# --------------------------------------------------

dated_df = df[df["event_date"].notna()].copy()

dated_df.to_csv(
    DATED_OUTPUT_FILE,
    index=False,
    encoding="utf-8"
)

# --------------------------------------------------
# 13. Display summary
# --------------------------------------------------

print("\n======================================")
print("LANDSLIDE DATASET READY")
print("======================================")

print(f"Total NER landslides : {len(df)}")
print(f"Dated landslides     : {len(dated_df)}")

print("\nState distribution:")
print(df["state"].value_counts())

print("\nDate range:")

if len(dated_df) > 0:
    print(
        f"From {dated_df['event_date'].min().date()} "
        f"to {dated_df['event_date'].max().date()}"
    )
else:
    print("No valid dates found.")

print("\nSaved files:")
print(OUTPUT_FILE)
print(DATED_OUTPUT_FILE)