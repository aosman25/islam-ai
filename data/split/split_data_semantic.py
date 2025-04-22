from encoders import DeepInfraEncoder
import os
from dotenv import load_dotenv
from semantic_chunkers import StatisticalChunker

import json
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

def semantic_chunk_books(input_folder, output_folder):
    encoder = DeepInfraEncoder(deepinfra_api_key=os.getenv("DEEPINFRA_API_KEY"))
    chunker = StatisticalChunker(encoder=encoder, plot_chunks=True)
    all_chunks = []  # List to store all chunks

    for root, dirs, files in os.walk(input_folder):
        for file in files:
            all_chunks = []
            if file.endswith('.txt'):  # Only process text files
                book_path = os.path.join(root, file)
                with open(book_path, "r", encoding="utf-8") as f:
                    book_text = f.read()

                book_text = clean_text(book_text)
                # Save the cleaned text to a new file
                with open("cleaned_book.txt", "w", encoding="utf-8") as f:
                    f.write(book_text)
                chunks = chunker(docs=[book_text]) 
                for chunkList in chunks:
                    for chunk in chunkList:
                        all_chunks.append({"text": " ".join(chunk.splits)})

            # Write all chunks to a single JSON file
            with open(output_folder, "w", encoding="utf-8") as json_file:
                json.dump(all_chunks, json_file, ensure_ascii=False, indent=4)

root_folder = os.path.dirname(os.getcwd())
input_folder = os.path.join(root_folder, "raw_data", "العقيدة")  # Adjust this to your actual data folder path
output_folder = os.path.join(root_folder, "output.json")  # Adjust this to your actual output folder path
semantic_chunk_books(input_folder, output_folder)


