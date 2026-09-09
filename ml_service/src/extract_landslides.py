import pdfplumber
import csv
import os

PDF_PATH = "data/raw/landslides/landslide_report.pdf"
OUTPUT_PATH = "data/processed/landslides_raw.csv"

os.makedirs("data/processed", exist_ok=True)

rows = []

print("Starting PDF extraction...")

with pdfplumber.open(PDF_PATH) as pdf:

    total_pages = len(pdf.pages)
    print(f"Total pages: {total_pages}")

    for page_number, page in enumerate(pdf.pages, start=1):

        if page_number % 100 == 0:
            print(f"Processed {page_number}/{total_pages} pages...")

        tables = page.extract_tables()

        for table in tables:

            if not table:
                continue

            for row in table:

                if row and any(cell for cell in row):
                    rows.append(row)

print(f"Total extracted rows: {len(rows)}")

if rows:

    max_columns = max(len(row) for row in rows)

    with open(
        OUTPUT_PATH,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as file:

        writer = csv.writer(file)

        for row in rows:

            row = row + [""] * (max_columns - len(row))
            writer.writerow(row)

    print(f"Saved: {OUTPUT_PATH}")

else:
    print("No tables were extracted.")