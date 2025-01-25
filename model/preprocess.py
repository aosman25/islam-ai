import os
from utils import read_json_files
import json


def convert_fatwas_to_jsonl(folder_relative_path):
    json_files = read_json_files(folder_relative_path)

    for fatwa_source, _, file_name in json_files:
        contents = []
        for fatwa in (
            fatwa_source if file_name != "islamweb_fatwas" else fatwa_source[0]
        ):
            contents.append({"role": "user", "parts": [{"text": fatwa["question"]}]})
            contents.append({"role": "model", "parts": [{"text": fatwa["answer"]}]})
        os.makedirs("fatwas_jsonl", exist_ok=True)
        with open(
            f"fatwas_jsonl/{file_name}.jsonl",
            "w",
            encoding="utf-8",
        ) as outfile:
            json.dump({"contents": contents}, outfile, ensure_ascii=False)


convert_fatwas_to_jsonl("fatwas")
