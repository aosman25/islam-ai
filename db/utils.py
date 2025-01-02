import json
import os
import tiktoken


def read_json_files(folder_relative_path, skip=False):
    json_data = []
    root_folder = os.path.dirname(os.getcwd())  # Set the root folder
    folder_path = os.path.join(root_folder, folder_relative_path)

    # Read books_progress.json if skip is enabled
    books_progress = {}
    if skip:
        try:
            with open("books_progress.json", "r", encoding="utf-8") as bp_file:
                books_progress = json.load(bp_file)
        except Exception as error:
            print(f"Error reading books_progress.json: {error}")

    try:
        # Walk through the folder and its subfolders
        for root, _, files in os.walk(folder_path):
            for file in files:
                if file.endswith(".json"):
                    file_name = os.path.splitext(file)[
                        0
                    ]  # Extract file name without extension
                    file_path = os.path.join(root, file)

                    # Check if we should skip this file
                    if skip and books_progress.get(file_name, None) == -1:
                        print(f"Skipping file {file} based on books_progress.json")
                        continue

                    try:
                        # Asynchronously read the JSON file
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                            data = json.loads(content)
                            json_data.append(
                                (data, file_path)
                            )  # Append tuple of data and file path
                    except json.JSONDecodeError as decode_error:
                        print(
                            f"Error decoding JSON in file {file_path}: {decode_error}"
                        )
                    except Exception as error:
                        print(f"Error reading file {file_path}: {error}")
    except Exception as error:
        print(f"Error traversing folder {folder_path}: {error}")

    return json_data


def count_chunks(folder_relative_path):
    data = read_json_files(folder_relative_path)
    chunks_count = 0
    for book_data, _ in data:
        chunks_count += len(book_data)
    return chunks_count


def count_tokens(folder_relative_path):
    encoding = tiktoken.get_encoding("cl100k_base")
    print("Reading Data from json files...")
    data = read_json_files(folder_relative_path)
    tokens_count = 0
    curr_book = 0
    for book_data, _ in data:
        print(f"Tokenizing book {curr_book + 1} out of {len(data)} books...")
        for chunk_data in book_data:
            tokens_count += len(encoding.encode(chunk_data["text"]))
        curr_book += 1
    print(f"Total Number of Tokens: {tokens_count}")
    return tokens_count


def split_json_file(folder_relative_path, output_file_prefix, max_size_in_gb=2):
    """
    Split a large JSON file into smaller parts based on a size limit (in GB).
    The file is expected to be an array of objects.

    Parameters:
    - input_file: Path to the input large JSON file.
    - output_file_prefix: Prefix for the output JSON files.
    - max_size_in_gb: Maximum size of each output file in GB (default: 1 GB).
    """
    max_size = max_size_in_gb * (1024**3)  # Convert GB to bytes
    root_folder = os.path.dirname(os.getcwd())  # Set the root folder
    input_file = os.path.join(root_folder, folder_relative_path)

    with open(input_file, "r", encoding="utf-8") as infile:
        data = json.load(infile)  # Read the entire JSON data into memory
        current_part = []
        current_size = 0
        part_number = 1

        for obj in data:
            current_part.append(obj)
            current_size += len(json.dumps(obj).encode("utf-8"))

            if current_size >= max_size:
                # Write the current part to a new file
                with open(
                    f"{output_file_prefix}_{part_number}.json", "w", encoding="utf-8"
                ) as outfile:
                    json.dump(current_part, outfile, ensure_ascii=False, indent=4)
                print(
                    f"Written part {part_number} with {current_size / (1024 ** 2):.2f} MB."
                )

                part_number += 1
                current_part = []  # Reset for the next part
                current_size = 0  # Reset size

        # Write the remaining part if any
        if current_part:
            with open(
                f"{output_file_prefix}_{part_number}.json", "w", encoding="utf-8"
            ) as outfile:
                json.dump(current_part, outfile, ensure_ascii=False, indent=4)
            print(f"Written final part {part_number}.")
