import os
from utils import read_json_files
import json
import random


def convert_fatwas_to_jsonl(folder_relative_path, merge=False):
    print("[DEBUG] Starting conversion of fatwas to JSONL...")
    try:
        json_files = read_json_files(folder_relative_path)
        print(
            f"[DEBUG] Found {len(json_files)} JSON file(s) in folder '{folder_relative_path}'."
        )
    except Exception as e:
        print(f"[ERROR] Failed to read JSON files in '{folder_relative_path}': {e}")
        return

    if merge:
        contents = []
        output_file_name = ""
        for fatwa_source, _, file_name in json_files:
            print(f"[DEBUG] Processing file '{file_name}' for merging...")
            for fatwa in fatwa_source:
                contents.append(
                    [
                        {"role": "user", "parts": [{"text": fatwa["question"]}]},
                        {"role": "model", "parts": [{"text": fatwa["answer"]}]},
                    ]
                )
            output_file_name += ("+" if output_file_name else "") + file_name
        random.shuffle(contents)
        print("[DEBUG] Shuffled merged contents.")
        training_dataset = contents[: (len(contents) - 256)]
        validation_dataset = contents[(len(contents) - 256) :]
        print(f"[DEBUG] Training dataset size: {len(training_dataset)}")
        print(f"[DEBUG] Validation dataset size: {len(validation_dataset)}")

        os.makedirs("fatwas_jsonl", exist_ok=True)
        training_file = f"fatwas_jsonl/{output_file_name + '_training'}.jsonl"
        validation_file = f"fatwas_jsonl/{output_file_name + '_validation'}.jsonl"
        try:
            with open(training_file, "w", encoding="utf-8") as outfile:
                for example in training_dataset:
                    json.dump({"contents": example}, outfile, ensure_ascii=False)
                    outfile.write("\n")
            with open(validation_file, "w", encoding="utf-8") as outfile:
                for example in validation_dataset:
                    json.dump({"contents": example}, outfile, ensure_ascii=False)
                    outfile.write("\n")
            print(f"[DEBUG] Successfully wrote merged training data to {training_file}")
            print(
                f"[DEBUG] Successfully wrote merged validation data to {validation_file}"
            )
        except Exception as e:
            print(f"[ERROR] Failed to write merged JSONL files: {e}")
    else:
        for fatwa_source, _, file_name in json_files:
            print(f"[DEBUG] Processing file '{file_name}' for separate conversion...")
            contents = []
            for fatwa in fatwa_source:
                contents.append(
                    [
                        {"role": "user", "parts": [{"text": fatwa["question"]}]},
                        {"role": "model", "parts": [{"text": fatwa["answer"]}]},
                    ]
                )
            os.makedirs("fatwas_jsonl", exist_ok=True)
            output_file = f"fatwas_jsonl/{file_name}.jsonl"
            try:
                with open(output_file, "w", encoding="utf-8") as outfile:
                    for example in contents:
                        json.dump({"contents": example}, outfile, ensure_ascii=False)
                        outfile.write("\n")
                print(
                    f"[DEBUG] Successfully converted '{file_name}' to JSONL: {output_file}"
                )
            except Exception as e:
                print(f"[ERROR] Failed to write JSONL file for '{file_name}': {e}")
