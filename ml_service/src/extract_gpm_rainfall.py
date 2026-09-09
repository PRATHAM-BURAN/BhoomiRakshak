import xarray as xr
from pathlib import Path


# ---------------------------------------------------------
# TEST LANDSLIDE
# ---------------------------------------------------------
LATITUDE = 24.478972
LONGITUDE = 92.682861
EVENT_DATE = "2016-05-17"

GPM_DIR = Path("data/raw/gpm")


# ---------------------------------------------------------
# FIND GPM FILE
# ---------------------------------------------------------
gpm_files = list(GPM_DIR.glob("*.nc4"))

if not gpm_files:
    raise FileNotFoundError(
        "No GPM .nc4 files found in data/raw/gpm/"
    )

# For this test we expect the 2016-05-17 file
target_file = None

for file in gpm_files:
    if "20160517" in file.name:
        target_file = file
        break

if target_file is None:
    raise FileNotFoundError(
        "GPM file for 2016-05-17 was not found."
    )


print("=" * 60)
print("GPM RAINFALL EXTRACTION TEST")
print("=" * 60)

print(f"Event date : {EVENT_DATE}")
print(f"Latitude   : {LATITUDE}")
print(f"Longitude  : {LONGITUDE}")
print(f"GPM file   : {target_file}")
print()


# ---------------------------------------------------------
# OPEN NETCDF
# ---------------------------------------------------------
print("Opening GPM NetCDF...")

ds = xr.open_dataset(target_file)

print("Dataset opened successfully.")
print()


# ---------------------------------------------------------
# FIND NEAREST GRID CELL
# ---------------------------------------------------------
print("Finding nearest GPM grid cell...")

rainfall = ds["precipitation"].sel(
    lat=LATITUDE,
    lon=LONGITUDE,
    method="nearest"
)


# ---------------------------------------------------------
# EXTRACT VALUES
# ---------------------------------------------------------
gpm_lat = float(
    ds["lat"].sel(lat=LATITUDE, method="nearest").values
)

gpm_lon = float(
    ds["lon"].sel(lon=LONGITUDE, method="nearest").values
)

rainfall_value = float(rainfall.values.squeeze())


# ---------------------------------------------------------
# RESULT
# ---------------------------------------------------------
print()
print("=" * 60)
print("RESULT")
print("=" * 60)

print(f"Requested latitude  : {LATITUDE}")
print(f"Requested longitude : {LONGITUDE}")

print()

print(f"Nearest GPM latitude  : {gpm_lat}")
print(f"Nearest GPM longitude : {gpm_lon}")

print()

print(f"Rainfall             : {rainfall_value:.2f}")

print("=" * 60)


# ---------------------------------------------------------
# CLOSE DATASET
# ---------------------------------------------------------
ds.close()