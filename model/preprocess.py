import os
from utils import read_json_files
import json
import random
from dotenv import load_dotenv
from ollama import Client
import re

load_dotenv()


def preprocess_islam_web_fatwas(folder_relative_path):
    print("[DEBUG] Starting preprocessing of Islam Web Fatwas...")
    try:
        # Read the first JSON file and unpack its contents
        fatwas, file_path, file_name = read_json_files(folder_relative_path)[0]
        print(f"[DEBUG] Loaded file: {file_name} from path: {file_path}")
    except Exception as e:
        print(f"[ERROR] Failed to read JSON files in '{folder_relative_path}': {e}")
        return

    new_data = []
    for i, fatwas_chunk in enumerate(fatwas, start=1):
        print(f"[DEBUG] Processing chunk {i} of {len(fatwas)}")
        new_data += [*fatwas_chunk]

    try:
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(new_data, file, ensure_ascii=False, indent=4)
        print(f"[DEBUG] Successfully wrote preprocessed data back to {file_path}")
    except Exception as e:
        print(f"[ERROR] Failed to write to {file_path}: {e}")


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


def clean_fatwas(folder_path):
    print("[DEBUG] Starting cleaning of fatwas...")
    client = Client(host=os.getenv("OLLAMA_URL"))
    print("[DEBUG] Initialized Ollama Client.")

    print("Reading JSON files...")
    try:
        json_files = read_json_files(folder_path)
        print(
            f"[DEBUG] Found {len(json_files)} JSON file(s) in folder '{folder_path}'."
        )
    except Exception as e:
        print(f"[ERROR] Failed to read JSON files in '{folder_path}': {e}")
        return

    for fatwa_source, _, file_name in json_files:
        print(f"[DEBUG] Processing file '{file_name}'")
        fatwas_cnt = len(fatwa_source)
        print(f"[DEBUG] Total fatwas in file '{file_name}': {fatwas_cnt}")
        file_path = f"{file_name}_cleaned.json"
        # Check if file exists and read existing data
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as json_file:
                try:
                    cleaned_fatwas = json.load(json_file)  # Load existing JSON data
                    if not isinstance(cleaned_fatwas, list):  # Ensure it's a list
                        cleaned_fatwas = []
                except json.JSONDecodeError:
                    cleaned_fatwas = []  # If file is empty or invalid JSON, start fresh
        else:
            cleaned_fatwas = []
        start = len(cleaned_fatwas)
        fatwa_curr = start + 1
        for fatwa in fatwa_source[start:]:
            print(
                f"[DEBUG] Preparing cleaning for Fatwa {fatwa_curr} out of {fatwas_cnt} in file '{file_name}'"
            )
            prompt = f"""
**السؤال:**  {fatwa["question"]}

**الفتوى الأصلية:**  {fatwa["answer"]}
"""
            print(
                f"[DEBUG] Sending request to Aya for Fatwa {fatwa_curr} of {fatwas_cnt} in '{file_name}'"
            )
            try:
                response = client.chat(
                    model="aya:latest",
                    messages=[
                        {"role":"user","content":'''
أنت مساعد تنظيف بيانات مخصص لإعداد مجموعة بيانات لتدريب نموذج محادثة فقهي إسلامي. دورك هو تحويل الفتاوى الخام إلى صيغة نظيفة ومنظمة ومتسقة، بحيث يكون النموذج الناتج قادرًا على الإجابة بأسلوب شيخ عالم، متعاطف، وواضح. يجب الحفاظ على أكبر قدر ممكن من التفاصيل المهمة في الفتوى الأصلية. لا تُحذف أي معلومة شرعية ذات صلة، إلا إذا كانت مكررة أو غير ضرورية. إذا كان هناك تعليل فقهي موسع، حافظ عليه ولكن قدّمه بطريقة أكثر وضوحًا وانسيابية.احرص دائمًا أن تشير إلى الآيات القرآنية، الأحاديث النبوية الشريفة التي ذكرت في الفتوي ولا تأتي بنصوص شرعية من عندك. لا تضف أي جمل تمهيدية مثل "إليك الفتوى بعد إعادة الصياغة" أو "هذا هو النص المعدل".  لا تطرح أي أسئلة للمتابعة بعد تقديم الإجابة، فقط قدّم النص النهائي كما هو. يجب تكون الفتوي النهائية من 500 ل 800 كلمة. التزم بالإرشادات التالية عند تعديل الفتاوى:
'''},
{"role":"user",
"content":'''

لا تضف أي مقدمات أو جمل تمهيدية مثل:

"إليك الفتوى المعدلة"

"ها هو النص بعد التعديل"

"حسناً، سأبدأ الإجابة مباشرة."
'''}
,
{"role":"user",
"content":'''

استخدم نبرة فردية وإنسانية:

تجنب ضمير الجمع (نحن، نبين، نرى).

استخدم صيغة المخاطب المباشر، مثل:

"أرى أن الحكم في هذه المسألة هو..." بدلًا من "نرى أن..."

"أقول مستعينًا بالله..." بدلًا من "نقول..."
'''}
,
{"role":"user",
"content":'''

أضف التعاطف واللمسة الشخصية:

خاطب السائل مباشرة، وأبدِ تفهّمك لوضعه.

استخدم عبارات تعكس الاهتمام والرحمة، مثل:

"أقدر حرصك على معرفة الحكم الشرعي."

"أسأل الله أن ييسر لك أمورك ويبارك لك في سعيك."
'''}
,
{"role":"user",
"content":'''

حافظ على وضوح الإجابة والتعليل:

اجعل الإجابة مباشرة وواضحة.

استخدم لغة سهلة الفهم عند ذكر الأسباب، مثل:

"لا يجوز تأخير الزكاة إلا لعذر معتبر، لأن الزكاة حق الفقراء."

"الحجاب واجب على المرأة المسلمة، وهو أمر ثابت في الشريعة لحفظ العفة والكرامة."
'''}
,
{"role":"user",
"content":'''

احتفظ بأكبر قدر ممكن من التفاصيل المهمة:

لا تحذف أي معلومة شرعية ذات صلة إلا إذا كانت مكررة أو غير ضرورية.

أعد تنظيم التعليل الفقهي الموسع ليكون أكثر وضوحًا وانسيابية.

لا تختصر التفاصيل المهمة بشكل مخلّ.
'''}
,
{"role":"user",
"content":'''

نوع في الخواتيم:

استخدم عبارات ختامية متنوعة، مثل:

"والله أعلم، وأسأل الله لك التوفيق."

"هذا والله أعلم، وصلى الله على نبينا محمد."

"أسأل الله أن ييسر لك الخير حيث كان."
'''}
,
{"role":"user",
"content":'''

إضافة فقرة ختامية:

يُفضّل إضافة دعاء أو توجيه لطيف، مثل:

"أسأل الله أن يوفقك لما يحب ويرضى."

"والله المستعان، وأسأل الله لك التوفيق في جميع أمورك."
'''}
,
{"role":"user",
"content":'''

استخدم تنوعًا في الصياغة:

لا تعتمد على قوالب ثابتة، بل أعد الصياغة بطرق مختلفة، مثل:

"الزكاة واجبة فور استحقاقها، وتأخيرها بلا عذر غير جائز."

"تأخير الزكاة يؤدي إلى تفويت حقوق الفقراء، لذا لا ينبغي الإقدام عليه دون مبرر شرعي."
'''}
,
{"role":"user",
"content":'''

تجنب اللغة المؤسسية أو الإشارات إلى مصادر خارجية:

لا تذكر أرقام الفتاوى أو تحيل إلى مصادر أخرى.

اجعل الإجابة مكتفية بذاتها دون إحالات خارجية.

لا تضف أحاديث أو آيات غير مذكورة في النص الأصلي.
'''}
,
{"role":"user",
"content":'''

اجعل الإجابة نصًا عربيًا متدفقًا وسلسًا:

نظّم الإجابة بحيث تبدأ بدعاء قصير، ثم تدخل في الجواب، يليه التعليل، ثم التعاطف، وأخيرًا الخاتمة.

استخدم لغة عربية فصحى واضحة وسهلة الفهم.
'''}, 
{"role":"user",
"content":'''
لا تقم بتكرار نفس الجمل او الاحاديث اكثر من مرة في نفس الاجابة
'''},
{"role":"user",
"content":prompt}                   
       
                        
                    ],
                    options={
                        "temperature": 0.3,
                        "num_ctx": 13000,
                        "num_predict": 7000,
                        "repetition_penalty": 1.3,  # Penalize repeated tokens
                        "presence_penalty": 0.8,  # Encourage diversity
                        "frequency_penalty": 0.6,  # Penalize frequent tokens
                    },
                )
            except Exception as e:
                print(
                    f"[ERROR] API call to Aya failed for Fatwa {fatwa_curr} in '{file_name}': {e}"
                )
                fatwa_curr += 1
                continue

            print(f"[DEBUG] Received response for Fatwa {fatwa_curr}")
            # Convert response to a dictionary if needed
            response_dict = (
                response.dict() if hasattr(response, "dict") else response.__dict__
            )
            content = response_dict.get("message", {}).get("content")

            # Clean the response content by removing unwanted phrases
            if content:
                # Define a flexible regex pattern to match variations of the unwanted phrase
                unwanted_intro_pattern = (
                    r"^\s*حسناً،?\s*سأبدأ\s*الإجابة\s*مباشرة[:：]?\s*"
                )

                # Remove any sequence that matches the pattern
                content = re.sub(unwanted_intro_pattern, "", content).strip()

                # Debug log to check cleaned content
                print(
                    f"[DEBUG] Cleaned response content for Fatwa {fatwa_curr}: {content[:100]}..."
                )  # Show first 100 chars
            else:
                print(
                    f"[WARNING] No content found in the response for Fatwa {fatwa_curr}"
                )
            cleaned_fatwas.append(
                {
                    "question": fatwa["question"],
                    "answer": content if content else "No content returned",
                }
            )
            print(
                f"[DEBUG] Saving Cleaned Fatwa {fatwa_curr} out of {fatwas_cnt} from file '{file_name}'"
            )
            try:
                with open(file_path, "w", encoding="utf-8") as json_file:
                    json.dump(cleaned_fatwas, json_file, indent=4, ensure_ascii=False)
                print(
                    f"[DEBUG] Successfully saved Cleaned Fatwa {fatwa_curr} to '{file_name}_cleaned.json'"
                )
            except Exception as e:
                print(f"[ERROR] Failed to write cleaned fatwas for '{file_name}': {e}")
            fatwa_curr += 1

        print(
            f"[DEBUG] Successfully cleaned all fatwas in file '{file_name}'. Cleaned data saved to '{file_name}_cleaned.json'."
        )


# Call the pipeline function
clean_fatwas(
    "/Users/alhassanahmed/Desktop/AI chatbot/fatwas"
)  # Replace 'fatwas' with the actual folder path if different
