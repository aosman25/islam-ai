from modules.encoders import DeepInfraEncoder
import os
from dotenv import load_dotenv
from semantic_chunkers import StatisticalChunker
import json
import uuid
import re
load_dotenv()


def clean_text(text):
    # Regular expression to match "{book_name}(ص: {number})"
    pattern = r"\b[\w\u0600-\u06FF]+\s*\(ص:\s*\d+\)"
    
    # Find the first occurrence of the pattern
    match = re.search(pattern, text)
    if match:
        text = text[match.start():]  # Remove everything before the first match

    # Remove all occurrences of the pattern
    text = re.sub(pattern, "", text)

    # Remove all newlines and extra spaces
    cleaned_text = " ".join(text.split())

    return cleaned_text

def semantic_chunk_books(input_folder, output_folder, authors):
    encoder = DeepInfraEncoder(deepinfra_api_key=os.getenv("DEEPINFRA_API_KEY"))
    chunker = StatisticalChunker(encoder=encoder)
    for root, _, files in os.walk(input_folder):
        for file in files:
            all_chunks = []  # List to store all chunks
            all_chunks = []
            book_path = os.path.join(root, file)
            with open(book_path, "r", encoding="utf-8") as f:
                print("Reading Book Content...")
                book_text = f.read()

            # Determine metadata
            knowledge = os.path.basename(input_folder)  # This is the input folder name
            category = os.path.basename(root) if os.path.relpath(root, input_folder) != '.' else knowledge
            book_name = os.path.splitext(file)[0]  # Book name without extension
            author = authors.get(book_name, "")  # Retrieve author from dictionary or use empty string if not found
            book_text = clean_text(book_text)
            # Save the cleaned text to a new file
            with open("cleaned_book.txt", "w", encoding="utf-8") as f:
                f.write(book_text)
            chunks = chunker(docs=[book_text]) 
            for chunkList in chunks:
                for chunk in chunkList:
                    all_chunks.append({
                        "book_name": book_name,
                        "knowledge": knowledge,
                        "id": str(uuid.uuid4()),  # Unique ID for each chunk
                        "category": category,
                        "author": author,
                        "text": " ".join(chunk.splits)
                        })
            # Define the output path including category as subfolder, or directly in root folder if no category
            if category == knowledge:  # If the category is the same as the knowledge folder, no subfolder
                category_folder = output_folder
            else:
                category_folder = os.path.join(output_folder, category)

            os.makedirs(category_folder, exist_ok=True)
            output_book_path = os.path.join(category_folder, f"{book_name}.json")

            # Write all chunks to a single JSON file
            with open(output_book_path, "w", encoding="utf-8") as json_file:
                json.dump(all_chunks, json_file, ensure_ascii=False, indent=4)

root_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
input_folder = os.path.join(root_folder, "raw_data", "العقيدة")
output_folder = os.path.join(root_folder, "chunked_data", "العقيدة")
authors = {"العقيدة التدمرية": "ابن تيمية"}

print("Resolved root:", root_folder)
print("Resolved input:", input_folder)
print("Exists:", os.path.exists(input_folder))


semantic_chunk_books(input_folder, output_folder, authors)

