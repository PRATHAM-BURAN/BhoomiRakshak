import earthaccess
import xarray as xr
import os

print("Logging into NASA Earthdata...")
earthaccess.login()

print("Searching GPM IMERG for 2016-05-17...")

results = earthaccess.search_data(
    short_name="GPM_3IMERGDF",
    version="07",
    temporal=("2016-05-17", "2016-05-17"),
    count=1
)

if not results:
    raise RuntimeError("GPM file not found")

print("Downloading test file...")

files = earthaccess.download(
    results[0],
    local_path="data/raw/gpm"
)

print("Downloaded:", files)

file_path = files[0]

print("\nOpening NetCDF...")

ds = xr.open_dataset(file_path)

print("\nVARIABLES:")
for name in ds.data_vars:
    print(name, ds[name].dims, ds[name].shape)

print("\nCOORDINATES:")
for name in ds.coords:
    print(name, ds[name].shape)

print("\nDATASET:")
print(ds)

ds.close()