import xarray as xr

GPM_FILE = "data/raw/gpm/3B-DAY.MS.MRG.3IMERG.20160517-S000000-E235959.V07B.nc4"

# Approximate North Eastern Region of India
LAT_MIN = 20
LAT_MAX = 30
LON_MIN = 88
LON_MAX = 98


print("=" * 60)
print("GPM NER REGION EXTRACTION TEST")
print("=" * 60)

print("\nOpening GPM file...")
ds = xr.open_dataset(GPM_FILE)

print("Original dataset:")
print(ds)

print("\nExtracting NER region...")

# Select only NER region
ner = ds["precipitation"].sel(
    lat=slice(LAT_MIN, LAT_MAX),
    lon=slice(LON_MIN, LON_MAX)
)

print("\nNER rainfall array:")
print(ner)

print("\nNER dimensions:")
print(ner.dims)

print("\nNER shape:")
print(ner.shape)

print("\nNER latitude range:")
print(float(ner.lat.min()), "to", float(ner.lat.max()))

print("\nNER longitude range:")
print(float(ner.lon.min()), "to", float(ner.lon.max()))

print("\nMemory size:")
print(f"{ner.nbytes / (1024 * 1024):.2f} MB")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)