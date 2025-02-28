from utils import read_json_files
import random
import json
import uuid
import math
import itertools


def generate_ids(folder_path):
    json_files = read_json_files(folder_path)
    print("Reading JSON Files")
    fatwas_length = len(json_files[0][0])
    print("Generating IDs...")
    ids = [str(uuid.uuid4()) for _ in range(fatwas_length)]

    for fatwa_source, file_path, file_name in json_files:
        data = []
        print(f"Adding IDs to {file_name}")
        for fatwa, id in zip(fatwa_source, ids):
            data.append(
                {
                    "id": id,
                    "question": fatwa["question"],
                    "answer": fatwa["answer"],
                }
            )
        with open(file_path, "w", encoding="utf-8") as json_file:
            json.dump(data, json_file, indent=4, ensure_ascii=False)
    print("Successfully Added ids!")


def create_instruct_dataset(relative_folder_path, instruction):
    json_files = read_json_files(relative_folder_path)
    data = []
    file_names = []
    for fatwa_source, _, file_name in json_files:
        for fatwa in fatwa_source:
            data.append(
                {
                    "instruction": instruction,
                    "input": fatwa["question"],
                    "output": fatwa["answer"],
                }
            )
        file_names.append(file_name)

    random.shuffle(data)
    with open(
        "+".join(file_names) + "_dataset.json", "w", encoding="utf-8"
    ) as json_file:
        json.dump(data, json_file, indent=4, ensure_ascii=False)

    print(f"Successfully Create a dataset of {len(data)} fatwas.")


def create_instruct_dataset_mixed(relative_folder_path, cleaned_ratio, instruction):
    def read_fatwas(json_files):
        """Extract fatwas from JSON file tuples."""
        return list(
            itertools.chain.from_iterable(
                fatwa_source for fatwa_source, _, _ in json_files
            )
        )

    # Read JSON files
    json_files_cleaned = read_json_files(f"{relative_folder_path}/cleaned")
    json_files_raw = read_json_files(f"{relative_folder_path}/raw")

    # Calculate total fatwas length
    fatwas_length = sum(len(fatwa[0]) for fatwa in json_files_cleaned)
    cleaned_fatwas_length = math.ceil(cleaned_ratio * fatwas_length)
    raw_fatwas_length = fatwas_length - cleaned_fatwas_length

    # Flatten lists
    cleaned_fatwas = read_fatwas(json_files_cleaned)
    raw_fatwas = read_fatwas(json_files_raw)

    # Sample data without duplicates
    sampled = set()
    data = []

    def sample_fatwas(fatwas_list, count):
        """Randomly sample fatwas while avoiding duplicates."""
        while count > 0:
            sampled_fatwa = random.choice(fatwas_list)
            if sampled_fatwa["id"] not in sampled:
                data.append(
                    {
                        "id": sampled_fatwa["id"],
                        "instruction": instruction,
                        "input": sampled_fatwa["question"],
                        "output": sampled_fatwa["answer"],
                    }
                )
                sampled.add(sampled_fatwa["id"])
                count -= 1

    # Sample from cleaned and raw fatwas
    sample_fatwas(cleaned_fatwas, cleaned_fatwas_length)
    sample_fatwas(raw_fatwas, raw_fatwas_length)

    # Shuffle and save dataset
    random.shuffle(data)
    save_to_json("mixed_dataset.json", data)

    print(f"Successfully created a dataset of {len(data)} fatwas.")


def save_to_json(filename, data):
    """Save data to a JSON file."""
    with open(filename, "w", encoding="utf-8") as json_file:
        json.dump(data, json_file, indent=4, ensure_ascii=False)


instruction = """
أنت شيخ متخصص في تقديم الفتاوى الشرعية المعتمدة. يجب أن تستند إجاباتك إلى مصادر موثوقة ومعتمدة باللغة العربية، يتم استرجاعها عبر نظام (RAG) يحتوي على مصادر شرعية صادرة عن جهات رسمية معترف بها.

دورك هو إعادة صياغة المعلومات المسترجعة وتحويلها إلى فتاوى شرعية دقيقة، واضحة، ومنهجية، تحاكي أسلوب العلماء الحقيقيين. يجب عليك تجنب إضافة اجتهادات شخصية أو معلومات غير موثقة.

إجاباتك يجب أن تكون موضوعية وتعتمد فقط على الأدلة الشرعية المتاحة، مع الحفاظ على وضوح اللغة العربية وسهولتها. عند تقديم التوجيه، يجب أن تظهر تعاطفك في سياق التوجيه والإرشاد، ولكن دون تحريف الأحكام أو تقديم فتاوى مخففة.

الهدف هو تقديم إجابات تشبه حديث العلماء الحقيقيين، منظمة، متماسكة، وطبيعية، دون أن تبدو إجابة آلية أو مكررة.
"""


create_instruct_dataset_mixed("fatwas", 0.7, instruction)
