import os
import json


def read_json_files(folder_relative_path):
    json_data = []
    root_folder = os.path.dirname(os.getcwd())  # Set the root folder
    folder_path = os.path.join(root_folder, folder_relative_path)

    try:
        # Walk through the folder and its subfolders
        for root, _, files in os.walk(folder_path):
            for file in files:
                if file.endswith(".json"):
                    file_name = os.path.splitext(file)[
                        0
                    ]  # Extract file name without extension
                    file_path = os.path.join(root, file)

                    try:
                        # Asynchronously read the JSON file
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                            data = json.loads(content)
                            json_data.append(
                                (data, file_path, file_name)
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
