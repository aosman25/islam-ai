import os
from utils import read_json_files
import json
from dotenv import load_dotenv
from ollama import Client

load_dotenv()


def clean_fatwas_aya(folder_path):
    print("[DEBUG] Starting cleaning of fatwas...")
    client = Client(host=os.getenv("OLLAMA_URL"))
    print("[DEBUG] Initialized Ollama Client.")
    with open("instructions.json", "r", encoding="utf-8") as json_file:
        instructions = json.load(json_file)
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
                        {
                            "role": "user",
                            "content": '\nأنت مساعد تنظيف بيانات مخصص لإعداد مجموعة بيانات لتدريب نموذج محادثة فقهي إسلامي. دورك هو تحويل الفتاوى الخام إلى صيغة نظيفة ومنظمة ومتسقة، بحيث يكون النموذج الناتج قادرًا على الإجابة بأسلوب شيخ عالم، متعاطف، وواضح. يجب الحفاظ على أكبر قدر ممكن من التفاصيل المهمة في الفتوى الأصلية. لا تُحذف أي معلومة شرعية ذات صلة، إلا إذا كانت مكررة أو غير ضرورية. إذا كان هناك تعليل فقهي موسع، حافظ عليه ولكن قدّمه بطريقة أكثر وضوحًا وانسيابية.احرص دائمًا أن تشير إلى الآيات القرآنية، الأحاديث النبوية الشريفة التي ذكرت في الفتوي ولا تأتي بنصوص شرعية من عندك. لا تضف أي جمل تمهيدية مثل "إليك الفتوى بعد إعادة الصياغة" أو "هذا هو النص المعدل".  لا تطرح أي أسئلة للمتابعة بعد تقديم الإجابة، فقط قدّم النص النهائي كما هو. يجب تكون الفتوي النهائية من 500 ل 800 كلمة. التزم بالإرشادات التالية عند تعديل الفتاوى:\n',
                        },
                        {
                            "role": "user",
                            "content": '\n\nلا تضف أي مقدمات أو جمل تمهيدية مثل:\n\n"إليك الفتوى المعدلة"\n\n"ها هو النص بعد التعديل"\n\n"حسناً، سأبدأ الإجابة مباشرة."\n',
                        },
                        {
                            "role": "user",
                            "content": '\n\nاستخدم نبرة فردية وإنسانية:\n\nتجنب ضمير الجمع (نحن، نبين، نرى).\n\nاستخدم صيغة المخاطب المباشر، مثل:\n\n"أرى أن الحكم في هذه المسألة هو..." بدلًا من "نرى أن..."\n\n"أقول مستعينًا بالله..." بدلًا من "نقول..."\n',
                        },
                        {
                            "role": "user",
                            "content": '\n\nأضف التعاطف واللمسة الشخصية:\n\nخاطب السائل مباشرة، وأبدِ تفهّمك لوضعه.\n\nاستخدم عبارات تعكس الاهتمام والرحمة، مثل:\n\n"أقدر حرصك على معرفة الحكم الشرعي."\n\n"أسأل الله أن ييسر لك أمورك ويبارك لك في سعيك."\n',
                        },
                        {
                            "role": "user",
                            "content": '\n\nحافظ على وضوح الإجابة والتعليل:\n\nاجعل الإجابة مباشرة وواضحة.\n\nاستخدم لغة سهلة الفهم عند ذكر الأسباب، مثل:\n\n"لا يجوز تأخير الزكاة إلا لعذر معتبر، لأن الزكاة حق الفقراء."\n\n"الحجاب واجب على المرأة المسلمة، وهو أمر ثابت في الشريعة لحفظ العفة والكرامة."\n',
                        },
                        {
                            "role": "user",
                            "content": "\n\nاحتفظ بأكبر قدر ممكن من التفاصيل المهمة:\n\nلا تحذف أي معلومة شرعية ذات صلة إلا إذا كانت مكررة أو غير ضرورية.\n\nأعد تنظيم التعليل الفقهي الموسع ليكون أكثر وضوحًا وانسيابية.\n\nلا تختصر التفاصيل المهمة بشكل مخلّ.\n",
                        },
                        {
                            "role": "user",
                            "content": '\n\nنوع في الخواتيم:\n\nاستخدم عبارات ختامية متنوعة، مثل:\n\n"والله أعلم، وأسأل الله لك التوفيق."\n\n"هذا والله أعلم، وصلى الله على نبينا محمد."\n\n"أسأل الله أن ييسر لك الخير حيث كان."\n',
                        },
                        {
                            "role": "user",
                            "content": '\n\nإضافة فقرة ختامية:\n\nيُفضّل إضافة دعاء أو توجيه لطيف، مثل:\n\n"أسأل الله أن يوفقك لما يحب ويرضى."\n\n"والله المستعان، وأسأل الله لك التوفيق في جميع أمورك."\n',
                        },
                        {
                            "role": "user",
                            "content": '\n\nاستخدم تنوعًا في الصياغة:\n\nلا تعتمد على قوالب ثابتة، بل أعد الصياغة بطرق مختلفة، مثل:\n\n"الزكاة واجبة فور استحقاقها، وتأخيرها بلا عذر غير جائز."\n\n"تأخير الزكاة يؤدي إلى تفويت حقوق الفقراء، لذا لا ينبغي الإقدام عليه دون مبرر شرعي."\n',
                        },
                        {
                            "role": "user",
                            "content": "\n\nتجنب اللغة المؤسسية أو الإشارات إلى مصادر خارجية:\n\nلا تذكر أرقام الفتاوى أو تحيل إلى مصادر أخرى.\n\nاجعل الإجابة مكتفية بذاتها دون إحالات خارجية.\n\nلا تضف أحاديث أو آيات غير مذكورة في النص الأصلي.\n",
                        },
                        {
                            "role": "user",
                            "content": "\n\nاجعل الإجابة نصًا عربيًا متدفقًا وسلسًا:\n\nنظّم الإجابة بحيث تبدأ بدعاء قصير، ثم تدخل في الجواب، يليه التعليل، ثم التعاطف، وأخيرًا الخاتمة.\n\nاستخدم لغة عربية فصحى واضحة وسهلة الفهم.\n",
                        },
                        {
                            "role": "user",
                            "content": "\nلا تقم بتكرار نفس الجمل او الاحاديث اكثر من مرة في نفس الاجابة\n",
                        },
                        {"role": "user", "content": prompt},
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
clean_fatwas_aya(
    "fatwas/islamqa"
)  # Replace 'fatwas' with the actual folder path if different
