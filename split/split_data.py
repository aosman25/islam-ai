import nltk
from nltk.tokenize import sent_tokenize
import os
import csv

# Ensure the required packages are downloaded
nltk.download('punkt')
nltk.download('punkt_tab')  # Important for Arabic language processing

def split_into_sentences(text):
    sentences = sent_tokenize(text)
    return sentences

def chunk_text_arabic(text, min_words=150, max_words=600, overlap=50):
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_word_count = 0

    def add_chunk():
        if current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk.clear()

    for paragraph in paragraphs:
        sentences = split_into_sentences(paragraph)
        for sentence in sentences:
            sentence_word_count = len(sentence.split())
            
            if current_word_count + sentence_word_count > max_words:
                add_chunk()
                current_word_count = 0

            current_chunk.append(sentence)
            current_word_count += sentence_word_count

            if current_word_count >= max_words:
                add_chunk()
                current_word_count = 0
                overlap_words = sentence.split()[-overlap:]
                current_chunk.extend(overlap_words)
                current_word_count = len(overlap_words)

    add_chunk()
    return chunks

def process_books_in_folder(input_folder, output_folder, csv_file_path):
    print(f"Processing books in folder: {input_folder}")
    
    # Ensure the output CSV directory exists
    os.makedirs(os.path.dirname(csv_file_path), exist_ok=True)

    # Open the CSV file for writing
    with open(csv_file_path, 'w', newline='', encoding='utf-8') as csv_file:
        csv_writer = csv.writer(csv_file)
        # Write the header
        csv_writer.writerow(['Knowledge', 'Category', 'Book Name', 'Chunk'])

        for root, dirs, files in os.walk(input_folder):
            for file in files:
                if file.endswith('.txt'):  # Only process text files
                    book_path = os.path.join(root, file)
                    print(f"Processing book: {file}")
                    with open(book_path, "r", encoding="utf-8") as f:
                        book_text = f.read()

                    chunks = chunk_text_arabic(book_text, min_words=150, max_words=600, overlap=50)
                    print(f"Generated {len(chunks)} chunks for book: {file}")

                    # Create the corresponding output directory for the book's chunks
                    relative_path = os.path.relpath(root, input_folder)
                    output_book_folder = os.path.join(output_folder, relative_path, os.path.splitext(file)[0])
                    os.makedirs(output_book_folder, exist_ok=True)
                    print(f"Output directory created: {output_book_folder}")

                    # Determine knowledge and category
                    knowledge = os.path.basename(input_folder)  # This is the input folder name
                    category = os.path.basename(root) if relative_path != '.' else 'NULL'  # Use 'NULL' for no category
                    book_name = os.path.splitext(file)[0]  # Book name without extension

                    for i, chunk in enumerate(chunks):
                        chunk_file_path = os.path.join(output_book_folder, f"chunk_{i + 1}.txt")
                        with open(chunk_file_path, "w", encoding="utf-8") as f:
                            f.write(chunk)
                        print(f"Wrote chunk {i + 1} to {chunk_file_path}")
                        
                        # Write chunk details to the CSV
                        csv_writer.writerow([knowledge, category, book_name, chunk])

# Set the root folder as the parent directory of the current working directory
root_folder = os.path.dirname(os.getcwd())
input_folder = os.path.join(root_folder, "data", "الفقة")  # Adjust this to your actual data folder path
output_folder = os.path.join(root_folder, "data_chunks", "الفقة")  # Adjust this to your actual output folder path
csv_file_path = os.path.join(root_folder, "data_chunks_csv", "الفقة.csv")  # Path for the output CSV file

# Process all books in the input folder
process_books_in_folder(input_folder, output_folder, csv_file_path)
