import earthaccess

print("Logging into NASA Earthdata...")

auth = earthaccess.login()

if not auth:
    raise RuntimeError("NASA Earthdata login failed.")

print("NASA Earthdata login successful!")

print("Searching GPM IMERG Final data...")

results = earthaccess.search_data(
    short_name="GPM_3IMERGDF",
    temporal=("2016-05-17", "2016-05-17"),
    bounding_box=(
        92.67,
        24.47,
        92.70,
        24.50
    ),
    count=10
)

print("Matching GPM files:", len(results))

for i, item in enumerate(results):
    print(f"\n--- Result {i + 1} ---")
    print(item)