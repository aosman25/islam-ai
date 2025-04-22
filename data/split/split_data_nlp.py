import nltk
from nltk.tokenize import sent_tokenize
import os
import json
import uuid
import unicodedata

# Ensure the required packages are downloaded
nltk.download('punkt')

def normalize_arabic(text):
    # Normalize common Arabic character variations
    text = unicodedata.normalize("NFKD", text)
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    text = text.replace("ى", "ي").replace("ة", "ه")
    text = text.replace("ؤ", "و").replace("ئ", "ي")
    return text

def split_into_sentences(text):
    # Custom Arabic sentence tokenizer
    sentences = sent_tokenize(text)
    return [s.strip() for s in sentences if s.strip()]

def chunk_text_arabic(text, min_words=100, max_words=400, overlap_sentences=2):
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_word_count = 0

    def add_chunk():
        nonlocal current_word_count
        # Ensure the chunk has at least min_words and does not exceed max_words
        if current_word_count >= min_words:
            chunks.append(" ".join(current_chunk))
            # Retain the last few sentences as overlap for continuity
            retained_sentences = current_chunk[-overlap_sentences:]
            current_chunk.clear()
            current_chunk.extend(retained_sentences)
            # Return word count of the overlap part
            return sum(len(sentence.split()) for sentence in current_chunk)
        return 0

    for paragraph in paragraphs:
        sentences = split_into_sentences(paragraph)
        for sentence in sentences:
            sentence_word_count = len(sentence.split())

            # Check if adding this sentence exceeds max_words before adding it
            if current_word_count + sentence_word_count > max_words:
                # If adding the sentence exceeds the limit, add the current chunk and reset
                current_word_count = add_chunk()

            # Add sentence to current chunk only if it won't exceed max_words
            if current_word_count + sentence_word_count <= max_words:
                current_chunk.append(sentence)
                current_word_count += sentence_word_count
            else:
                # If sentence exceeds limit after overlap, add a chunk and start a new one
                current_word_count = add_chunk()
                current_chunk.append(sentence)
                current_word_count += sentence_word_count

    # Add any remaining text as the last chunk
    add_chunk()
    return chunks

def split_large_chunks(chunks, max_words):
    """Split any chunks larger than max_words into smaller chunks"""
    final_chunks = []
    for chunk in chunks:
        words = chunk.split()
        while len(words) > max_words:
            # Split the chunk into smaller chunks, each less than max_words
            final_chunks.append(" ".join(words[:max_words]))
            words = words[max_words:]
        # Add the remaining words as the last chunk
        if words:
            final_chunks.append(" ".join(words))
    return final_chunks

def process_books_in_folder(input_folder, output_folder, authors):
    print(f"Processing books in folder: {input_folder}")

    for root, dirs, files in os.walk(input_folder):
        for file in files:
            if file.endswith('.txt'):  # Only process text files
                book_path = os.path.join(root, file)
                print(f"Processing book: {file}")
                with open(book_path, "r", encoding="utf-8") as f:
                    book_text = normalize_arabic(f.read())

                # Improved chunking with enhanced overlap and normalization
                chunks = chunk_text_arabic(book_text, min_words=100, max_words=400, overlap_sentences=2)
                # Split chunks larger than max_words into smaller chunks
                final_chunks = split_large_chunks(chunks, max_words=400)
                print(f"Generated {len(final_chunks)} chunks for book: {file}")

                # Determine metadata
                knowledge = os.path.basename(input_folder)  # This is the input folder name
                category = os.path.basename(root) if os.path.relpath(root, input_folder) != '.' else knowledge
                book_name = os.path.splitext(file)[0]  # Book name without extension
                author = authors.get(book_name, "")  # Retrieve author from dictionary or use empty string if not found

                # Prepare JSON data for this book
                book_data = []
                for chunk in final_chunks:
                    chunk_data = {
                        "text": chunk,
                        "book_name": book_name,
                        "knowledge": knowledge,
                        "id": str(uuid.uuid4()),  # Unique ID for each chunk
                        "category": category,
                        "author": author
                    }
                    book_data.append(chunk_data)

                # Define the output path including category as subfolder, or directly in root folder if no category
                if category == knowledge:  # If the category is the same as the knowledge folder, no subfolder
                    category_folder = output_folder
                else:
                    category_folder = os.path.join(output_folder, category)

                os.makedirs(category_folder, exist_ok=True)
                output_book_path = os.path.join(category_folder, f"{book_name}.json")

                # Save JSON data to file
                with open(output_book_path, "w", encoding="utf-8") as json_file:
                    json.dump(book_data, json_file, ensure_ascii=False, indent=4)
                print(f"Saved JSON data to {output_book_path}")


# Example author dictionary mapping book names to authors
authors = {
    "البحر المحيط في أصول الفقه - ط الكتبي": "بدر الدين الزركشي",
    "المستصفى من علم الأصول": "أبو حامد محمد بن محمد الغزالي",
    "الرسالة للشافعي": "محمد بن إدريس الشافعي",
    # Add additional mappings as needed
}

# Set the root folder as the parent directory of the current working directory
root_folder = os.path.dirname(os.getcwd())
input_folder = os.path.join(root_folder, "data", "الفقة")  # Adjust this to your actual data folder path
output_folder = os.path.join(root_folder, "data_chunks_json", "الفقة")  # Adjust this to your actual output folder path

# Process all books in the input folder
process_books_in_folder(input_folder, output_folder, authors)
