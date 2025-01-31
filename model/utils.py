import os
import json
import tiktoken
import transformers


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


def deepseek_tokenizer(txt):
    chat_tokenizer_dir = "./config/"

    tokenizer = transformers.AutoTokenizer.from_pretrained(
        chat_tokenizer_dir, trust_remote_code=True
    )

    result = tokenizer.encode(txt)

    return result


def count_tokens(folder_relative_path, prompt, deepseek=True):
    encoding = tiktoken.get_encoding("o200k_base")
    print("Reading Data from json files...")
    data = read_json_files(folder_relative_path)
    print("Counting prompt tokens...")
    prompt_tokens = (
        len(deepseek_tokenizer(prompt)) if deepseek else len(encoding.encode(prompt))
    )
    print("Counting Input tokens...")
    input_tokens = 0
    for fatwa_source, _, _ in data:
        for fatwa in fatwa_source:
            input_tokens += (
                len(deepseek_tokenizer(fatwa["question"] + fatwa["answer"]))
                if deepseek
                else len(encoding.encode(fatwa["question"] + fatwa["answer"]))
            )

    print(f"Total Prompt Tokens: {prompt_tokens}")
    print(f"Total Input Tokens: {input_tokens}")
    return prompt_tokens, input_tokens
