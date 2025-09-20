import os
import pandas as pd
import json
from typing import List
from ast import literal_eval
from models import SourceData, AskRequest 

# Input and output directories
source_dir = "sample_sources"
output_dir = "sample_requests"

# Make sure output directory exists
os.makedirs(output_dir, exist_ok=True)

# Iterate over all CSV files in source_dir
for filename in os.listdir(source_dir):
    if filename.endswith(".csv"):
        query = filename[:-4]  # remove .csv extension
        csv_path = os.path.join(source_dir, filename)

        # Load the CSV file
        df = pd.read_csv(csv_path)

        # Convert rows to SourceData objects
        sources = [
            SourceData(
                distance=row["score"],
                id=row["id"],
                book_id=row["book_id"],
                book_name=row["book_name"],
                order=int(row["order"]),
                author=row["author"],
                knowledge=row["knowledge"],
                category=row["category"],
                header_titles=literal_eval(row["header_titles"]),
                page_range=literal_eval(row["page_range"]),
                text=row["text"]
            )
            for _, row in df.iterrows()
        ]

        # Create AskRequest object
        ask_request = AskRequest(
            query=query,
            sources=sources
        )

        # Write output to JSON
        output_path = os.path.join(output_dir, f"{query}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(ask_request.model_dump(), f, ensure_ascii=False, indent=2)

        print(f"✓ Wrote {output_path}")

# "هل يُعدّ الأشاعرة من أهل السنة والجماعة في العقيدة؟"