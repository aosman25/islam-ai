import os
from utils import read_json_files
import json
import random
from dotenv import load_dotenv
from ollama import Client

load_dotenv()


def preprocess_islam_web_fatwas(folder_relative_path):
    fatwas, file_path, file_name = read_json_files(folder_relative_path)[0]
    new_data = []
    for fatwas_chunk in fatwas:
        new_data += [*fatwas_chunk]
    with open(
        file_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(new_data, file, ensure_ascii=False, indent=4)


def convert_fatwas_to_jsonl(folder_relative_path, merge=False):

    json_files = read_json_files(folder_relative_path)
    if merge:
        contents = []
        output_file_name = ""
        for fatwa_source, _, file_name in json_files:
            for fatwa in fatwa_source:
                contents.append(
                    [
                        {"role": "user", "parts": [{"text": fatwa["question"]}]},
                        {"role": "model", "parts": [{"text": fatwa["answer"]}]},
                    ]
                )

            output_file_name += ("+" if len(output_file_name) != 0 else "") + file_name
        random.shuffle(contents)
        training_dataset = contents[: (len(contents) - 256)]
        validation_dataset = contents[(len(contents) - 256) :]
        os.makedirs("fatwas_jsonl", exist_ok=True)
        with open(
            f"fatwas_jsonl/{output_file_name + '_training'}.jsonl",
            "w",
            encoding="utf-8",
        ) as outfile:
            for example in training_dataset:
                json.dump({"contents": example}, outfile, ensure_ascii=False)
                outfile.write("\n")
        with open(
            f"fatwas_jsonl/{output_file_name + '_validation'}.jsonl",
            "w",
            encoding="utf-8",
        ) as outfile:
            for example in validation_dataset:
                json.dump({"contents": example}, outfile, ensure_ascii=False)
                outfile.write("\n")
    else:
        for fatwa_source, _, file_name in json_files:
            contents = []
            for fatwa in fatwa_source:
                contents.append(
                    [
                        {"role": "user", "parts": [{"text": fatwa["question"]}]},
                        {"role": "model", "parts": [{"text": fatwa["answer"]}]},
                    ]
                )
            os.makedirs("fatwas_jsonl", exist_ok=True)
            with open(
                f"fatwas_jsonl/{file_name}.jsonl",
                "w",
                encoding="utf-8",
            ) as outfile:
                for example in contents:
                    json.dump({"contents": example}, outfile, ensure_ascii=False)
                    outfile.write("\n")


def clean_fatwas(folder_path):
    client = Client(
        host=os.getenv("OLLAMA_URL"),
    )
    print("Reading JSON files...")
    json_files = read_json_files(folder_path)
    for fatwa_source, _, _ in json_files:
        cleaned_fatwas = []
        for fatwa in fatwa_source:
            prompt = f"""
**المهمة**
أنت مساعد تنظيف بيانات مخصص لإعداد مجموعة بيانات لتدريب نموذج محادثة فقهي إسلامي. دورك هو تحويل الفتاوى الخام إلى صيغة نظيفة ومنظمة ومتسقة، بحيث يكون النموذج الناتج قادرًا على الإجابة بأسلوب شيخ عالم، متعاطف، وواضح. **يجب الحفاظ على أكبر قدر ممكن من التفاصيل المهمة في الفتوى الأصلية. لا تُحذف أي معلومة شرعية ذات صلة، إلا إذا كانت مكررة أو غير ضرورية. إذا كان هناك تعليل فقهي موسع، حافظ عليه ولكن قدّمه بطريقة أكثر وضوحًا وانسيابية.احرص دائمًا أن تشير إلى الآيات القرآنية، الأحاديث النبوية الشريفة التي ذكرت في الفتوي ولا تأتي بنصوص شرعية من عندك. لا تضف أي جمل تمهيدية مثل "إليك الفتوى بعد إعادة الصياغة" أو "هذا هو النص المعدل".  لا تطرح أي أسئلة للمتابعة بعد تقديم الإجابة، فقط قدّم النص النهائي كما هو. يجب تكون الفتوي النهائية من 500 ل 800 كلمة.** التزم بالإرشادات التالية عند تعديل الفتاوى:

1. **استخدم نبرة فردية وإنسانية:**  
   - تحدّث بصيغة المفرد دائمًا، وتجنب ضمير الجمع (نحن، نبين، نرى).  
   - اجعل الإجابة تبدو وكأنها من شخص عالم يخاطب السائل مباشرة، مثل:  
     - "أرى أن الحكم في هذه المسألة هو..." بدلًا من "نرى أن..."  
     - "أقول مستعينًا بالله..." بدلًا من "نقول..."
2. **أضف التعاطف واللمسة الشخصية:**  
   - خاطب السائل مباشرة، وأبدِ تفهّمك لوضعه.  
   - استخدم عبارات تعكس الاهتمام والرحمة، مثل:  
     - "أقدر حرصك على معرفة الحكم الشرعي."  
     - "أسأل الله أن ييسر لك أمورك ويبارك لك في سعيك."
3. **حافظ على وضوح الإجابة والتعليل:**  
   - اجعل الإجابة مباشرة وواضحة، وتجنب الحشو أو التعقيد غير الضروري.  
   - عند ذكر الأسباب، استخدم مبادئ الشريعة بلغة سهلة الفهم.  
   - مثال:  
     - "لا يجوز تأخير الزكاة إلا لعذر معتبر، لأن الزكاة حق الفقراء."  
     - "الحجاب واجب على المرأة المسلمة، وهو أمر ثابت في الشريعة لحفظ العفة والكرامة."
4. **احتفظ بأكبر قدر ممكن من التفاصيل المهمة:**  
   - لا تحذف أي معلومة شرعية ذات صلة إلا إذا كانت مكررة أو غير ضرورية.  
   - إذا كان هناك تعليل فقهي موسع، فاحتفظ به، ولكن أعد تنظيمه ليكون أكثر وضوحًا وانسيابية.  
   - إذا تضمنت الفتوى تفصيلًا مهمًا لمسألة معينة، فلا تختصره بشكل مخلّ، بل قدّمه بطريقة أكثر سلاسة وفهمًا.
5. **نوع في الخواتيم:**  
   - استخدم عبارات ختامية متنوعة حتى لا يصبح النموذج نمطيًا، مثل:  
     - "والله أعلم، وأسأل الله لك التوفيق."  
     - "هذا والله أعلم، وصلى الله على نبينا محمد."  
     - "أسأل الله أن ييسر لك الخير حيث كان."
   - **إضافة فقرة ختامية:**  
     - يُفضّل دائمًا إضافة فقرة ختامية تتضمن دعاء أو توجيه لطيف، مثل:  
       - "أسأل الله أن يوفقك لما يحب ويرضى."  
       - "والله المستعان، وأسأل الله لك التوفيق في جميع أمورك."
6. **استخدم تنوعًا في الصياغة:**  
   - لا تعتمد على قوالب ثابتة في إعادة كتابة الفتاوى.  
   - أعد الصياغة بطرق مختلفة للحكم نفسه، مثل:  
     - "الزكاة واجبة فور استحقاقها، وتأخيرها بلا عذر غير جائز."  
     - "تأخير الزكاة يؤدي إلى تفويت حقوق الفقراء، لذا لا ينبغي الإقدام عليه دون مبرر شرعي."
7. **تجنب اللغة المؤسسية أو الإشارات إلى مصادر خارجية:**  
   - لا تستخدم عبارات تشير إلى أن الإجابة صادرة عن مؤسسة أو جهة (مثل "على موقعنا" أو "راجع الفتوى رقم كذا").  
   - لا تذكر أرقام الفتاوى أو تحيل إلى مصادر أخرى، بل اجعل الإجابة مكتفية بذاتها.  
   - لا تعتمد على نقل الأحاديث أو الآيات إلا إذا كانت موجودة في النص الأصلي للسؤال.
8. **اجعل الإجابة نصًا عربيًا متدفقًا وسلسًا:**  
   - نظّم الإجابة بحيث تبدأ بدعاء قصير، ثم تدخل في الجواب، تليه التعليل، ثم التعاطف، وأخيرًا الخاتمة.  
   - اكتب بأسلوب طبيعي ومنطقي يشبه كلام العلماء في الحوار مع السائل.  
   - استخدم لغة عربية فصحى واضحة وسهلة الفهم.

**السؤال:**  {fatwa["question"]}

**الفتوى الأصلية:**  {fatwa["answer"]}
"""
            print("Cleaning with Aya...")
            response = client.chat(
                model="aya:latest",
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                options={
                    "temperature": 0.3,
                    "num_ctx": 10000,
                    "num_predict": 10000,
                },
            )

            # Convert response to a dictionary if needed
            response_dict = (
                response.dict() if hasattr(response, "dict") else response.__dict__
            )
            cleaned_fatwas.append(
                {
                    "question": fatwa["question"],
                    "answer": response_dict["message"]["content"],
                }
            )
            print("Saving Cleaned Fatwa...")
            # Save response to a JSON file
            with open("cleaned_fatwas.json", "w", encoding="utf-8") as json_file:
                json.dump(cleaned_fatwas, json_file, indent=4, ensure_ascii=False)

    print("Response saved to cleaned_fatwas.json")


clean_fatwas(
    "fatwas"
)  # fatwas should be a folder in the root directory with the json files of fatwas
