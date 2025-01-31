import os
from utils import read_json_files
import json
import random
from dotenv import load_dotenv
from openai import OpenAI


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


def clean_fatwas(question, fatwa):
    prompt = f"""
    Context for the Task:
    "We are preparing a fine-tuning dataset to train an Islamic legal chatbot. The goal is to create a responsive, conversational model that behaves like a knowledgeable and humane sheikh. The model should use a singular tone (first person), avoiding institutional or group references (e.g., 'نحن'). Responses should feel empathetic, flexible, and human-like, demonstrating clarity, reasoning, and a personal connection with the questioner."
    Your Role 
    "Your role is to act as a data-cleaning assistant, responsible for transforming raw Fatwas into a clean, structured, and consistent format suitable for fine-tuning the chatbot. The input will be the question and the answer to it ( the fatwa) and you will be responsible for solely modifying the fatwa based on the following instructions. You will:
    Maintain Structure: Organize the response into logical components—Invocation, Answer, Reasoning, Empathy, and Conclusion.
    Generalize Content: Avoid rigidly replicating templates or specific details (e.g., Fatwa numbers or unverifiable references). Focus on teaching the model the general style and process of answering Islamic queries.
    Improve Clarity: Ensure responses are written in clear, grammatically correct Arabic, with proper punctuation and spacing.
    Add Variability: Introduce variation in phrasing, invocations, and closings to make the dataset diverse and prevent overfitting.
    Preserve Tone: Maintain a singular, conversational, and empathetic tone, ensuring the response feels like it’s coming from a knowledgeable and approachable individual.

    Extensive Instructions for Cleaning Fatwas
    1. Use a Singular, Human-Like Tone
    Avoid plural pronouns (e.g., 'نحن', 'نُبين') and institutional language. Use first-person singular forms:
    "أرى" instead of "نرى"
    "أقول" instead of "نقول"
    "أرجو" instead of "نرجو"
    Ensure the response feels personal and conversational.

    2. Add Empathy and Personal Touch
    The response should feel like it’s coming from a humane and understanding person, not a rigid system.
    Examples:
    Acknowledge the questioner’s situation:
    "سؤالك مهم، وأقدر حرصك على معرفة الحكم الشرعي."
    Reflect empathy:
    "أسأل الله أن يوفقك لكل خير ويعينك على أداء الواجبات."
    Address the questioner directly where appropriate:
    "إن كنت تعاني من ظروف خاصة، فاعلم أن الشريعة تراعي الأحوال."

    3. Maintain Clarity in Answer and Reasoning
    Answer:
    Directly respond to the question with clarity.
    Avoid overly complex or verbose language unless necessary.
    Example:
    "لا يجوز تأخير دفع الزكاة بعد وجوبها، ولكن إذا واجهت ظروفًا قاهرة، يمكنك البحث عن حلول مثل بيع بعض الممتلكات."
    Reasoning:
    Provide a rationale using Islamic principles in simple terms.
    Example:
    "الزكاة فريضة تهدف إلى تحقيق التكافل بين المسلمين، وهي واجبة عند استحقاقها لضمان حق الفقراء."

    4. Vary Closings
    Use diverse closing statements to ensure variability:
    "نسأل الله لك التوفيق والسداد."
    "والله أعلم، وأرجو أن تكون الإجابة واضحة."
    "هذا والله أعلم، وصلى الله على نبينا محمد."
    "نسأل الله أن يعينك على كل خير، والله أعلم."

    5. Include Flexible Phrasing
    Avoid rigid templates by rephrasing similar rulings in different ways:
    Example variations:
    "من الواجب إخراج الزكاة في وقتها لأنها حق للفقراء."
    "تأخير الزكاة غير جائز لأنه يفوّت على المحتاجين حقوقهم."
    "الزكاة عبادة تُطهِّر المال، وتأخيرها يعطّل هذا الهدف."

    6. Handle Non-Religious or Ambiguous Queries
    If the query is unrelated to Islamic rulings:
    Respond with a respectful redirection:
    "هذا السؤال لا يتعلق بالأحكام الشرعية. يُرجى استشارة متخصص في هذا المجال."
    If the query is unclear:
    Ask for clarification empathetically:
    "لم أفهم السؤال بشكل واضح. هل يمكنك التوضيح أكثر؟"

    7. Avoid Over-Specific or Institutional Language
    Eliminate Institutional Phrasing: Do not use phrases that suggest the response is coming from a group or organization (e.g., "على موقعنا" or "نحن نوصي"). Always respond as an individual speaking directly to the questioner.
    Remove Fabricated or Unverifiable References:
    Do not include references to Fatwa numbers, Hadith citations, or Quranic verses unless they are explicitly mentioned in the input.
    Avoid referencing other Fatwas or suggesting the user check another source (e.g., "راجع الفتوى رقم 12345"). 
    Treat Each Fatwa as Independent:
    Respond to each query as a standalone question without implying connections to previous answers or external content. The response should provide complete, self-contained guidance to the user without relying on additional references.

    8. Format the final response as a Natural Arabic Paragraph
    Deliver the output in a cohesive paragraph with a conversational flow:
    Invocation → Answer → Reasoning → Empathy/Personal Touch → Conclusion.
    Ensure it feels like a natural discussion with a scholar rather than a robotic system.
    Ensure the final answer is written in clear, simple and comprenshible formal arabic please.
    Don't add explanation of what you did, just make the change

    Input:
    Question: "{question}"
    Fatwa: "{fatwa}"
    
    Output:
    """

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("DEEPSEEK_KEY"),
    )

    completion = client.chat.completions.create(
        model="deepseek/deepseek-r1:free",
        messages=[
            {
                "role": "system",
                "content": "You are a knowledgeable and empathetic Islamic scholar preparing fatwas in a structured, clear, and conversational manner.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    print(completion)
    print(completion.choices[0].message.content)


clean_fatwas(
    "بخصوص اختلاف القراءات ووجود كلمات زائدة في قراءة غير موجودة في قراءة أخرى فكيف كتبت في مصحف عثمان، أليس وجود كلمة زائدة يعني أنها مخالفة للمصحف العثماني؟",
    "الحمد لله. أولا: سبب استشكال السائل أنه فهم مِن ذكرِ موافقة خطِّ المصحف، وذكر مصحفِ عثمانَ أنّ عثمانَ رضي الله عنه أمر بكتابةِ مصحفٍ واحدٍ، وبالتالي فأيُّ كلمةٍ إما أنْ تكون ثابتةً في المصحف أو لا تكون، وينبني عليه أنه لا يجوز أنْ يكون الاختلافُ بين القراءات المتواترة خلافًا في الإثبات والحذف، وهذا ليس بدقيق، بل الثابتُ عن عثمان رضي الله عنه، والمقرر عند أهل العلم أن عثمان رضي الله عنه أمر بكتابةِ عدّةِ مصاحف، وأرسل بها إلى الأمصار، وبين هذه المصاحفِ اختلافٌ محصورٌ مدوَّنٌ عندَ أهل العلم . وقد ثبت في صحيح البخاري (4987) عن أنس بن مالك رضي الله عنه : ” أنّ حذيفة بن اليمان، قدم على عثمان ..، فقال حذيفةُ لعثمان: يا أمير المؤمنين، أدركْ هذه الأمةَ ، قبل أن يختلفوا في الكتابِ اختلافَ اليهودِ والنصارى ، فأرسل عثمان إلى حفصةَ : أنْ أرسلي إلينا بالصُّحفِ ننسخُها في المصاحفِ ، ثم نردُّها إليكِ ، فأرسلتْ بها حفصةُ إلى عثمانَ ، فأمر زيدَ بنَ ثابت ، وعبدَ الله بنَ الزبير ، وسعيدَ بنَ العاص ، وعبدَ الرحمن بنَ الحارث بن هشام ، فنسخوها في المَصاحف ” ..، حتى إذا نسخوا الصُّحفَ في المَصاحف، ردّ عثمانُ الصحفَ إلى حفصةَ ، وأرسل إلى كلِّ أُفُقٍ بمُصحفٍ ممّا نَسخوا.. ” . وفي رواية أبي بكر ابن أبي داود في كتابه “المصاحف” (ص: 94) : قال أنسُ بن مالك رضي الله عنه : ” ففزع لذلك عثمانُ فزَعًا شديدًا ، فأرسل إلى حفصةَ ، فاستخرج الصحيفةَ التي كان أبو بكرٍ أمر زيدًا بجمعِها ، فنسخ منها مصاحفَ ، فبعث بها إلى الآفاقِ “. ثانيا: المشترط في صحة القراءة موافقة رسم أحد المصاحف العثمانية: قال الإمام ابن الجزري في “منجد المقرئين” (ص: 18) : ” كلُّ قراءةٍ وافقت العربيةَ مطلقًا، ووافقت أحدَ المصاحفِ العثمانيةِ ولو تقديرًا وتواتر نقلُها، هذه القراءةُ المتواترة المقطوعُ بها “. ثم قال : ” ومعنى أحدِ المصاحف العثمانية : واحدٌ مِن المصاحف التي وجّهها عثمانُ رضي الله عنه إلى الأمصار ، وكقراءة ابنِ كثير في التوبة ( جَنَّاتٍ تَجْرِي مِنْ تَحْتِهَا الْأَنْهَارُ ) [التوبة: 72] بزيادة (مِن) ؛ فإنها لا توجد إلا في مصحفِ مكّة . ومعنى (ولو تقديرًا) ما يحتمله رسمُ المصحف ، كقراءة مَن قرأ : ( مَالِكِ يَوْمِ الدِّينِ ) [الفاتحة: 4] بالألف ؛ فإنها كُتبت بغير ألفٍ في جميع المصاحف ، فاحتملت الكتابةُ أن تكون (مالك) ، وفُعل بها كما فُعل باسم الفاعل مِن قوله: (قادر) و(صالح) ونحو ذلك مما حُذفت منه الألفُ للاختصار، فهو موافقٌ للرسم تقديرًا ” انتهى. ثالثا: اختُلف في عدد المصاحف العثمانية، وأشهرها قولان: أربعة مصاحف، وسبعة مصاحف. قال أبو عمرو الداني في “المقنع في رسم مصاحف الأمصار” (ص: 19) : ” أكثرُ العلماء على أنَ عثمان بنَ عفان رضي الله عنه لمّا كتب المصحفَ جعله على أربعِ نسخٍ ، وبعث إلى كلِّ ناحيةٍ مِن النواحي بواحدةٍ منهنّ ، فوجّه إلى الكوفة إحداهنّ ، وإلى البصرة أخرى ، وإلى الشام الثالثة ، وأمسك عند نفسه واحدةً ، وقد قيل: إنه جعله سبعَ نسخٍ ، ووجّه من ذلك أيضًا نسخةً إلى مكةَ ، ونسخةً إلى اليمن ، ونسخةً إلى البحرين ، والأولُ أصحُّ ، وعليه الأئمةُ ” انتهى. ويُنظر في مناقشة الأقوال والترجيح بينها : مناهل العرفان للزرقاني (1/402) . رابعا: أطلق بعضُ أهلِ العلم على المصحف الذي تركه عثمان عنده ” المصحف الإمام ” ، قال الإمام ابن أبي داود في “المصاحف” (ص: 139) : ” الإمامُ الذي كتب منه عثمانُ رضي الله عنه المصاحفَ ، وهو مصحفُه ” انتهى . ولا يعنون بذلك أنه المصحف الوحيد الذي كتبه عثمانُ رضي الله عنه ، وإنما المراد به المصحفَ الذي بقي عنده ، وكان يقرأ فيه ، وقُتل رضي الله عنه وهو يقرأ فيه ، وسال دمُه عليه . قال المارغني في “دليل الحيران على مورد الظمآن” (ص: 6) : “أما المصحف الإمام فقد احتفظ به الخليفةُ عثمان رضي الله عنه لنفسه ، وسمي الإمامَ ؛ لأنه اعتُبر الأصل لباقي مصاحف الأمصار المرسلة ، وأنه المرجع للأمة “. وقد يُعبّر بالمصحف الإمام عن مجموع المصاحف المنسوخة التي أرسلت إلى الأمصار كما قال الشيخ الطاهر ابن عاشور في تفسيره “التحرير والتنوير” (29/378) : ” وكُتب {سَلاسِلا} في المصحفِ الإِمامِ في جميع النسخ التي أُرسلت إلى الأمصار بألفٍ بعدَ اللامِ الثانيةِ ، ولكن القراء اختلفوا في قراءته ..” انتهى . وقال د. إبراهيم الدوسري في “مختصر العبارات لمعجم مصطلحات القراءات” (ص: 120) مبينًا إطلاق هذا اللفظ على المعنيين : ” (مصحف الإمام): * مصحف أمير المؤمنين عثمان ابن عفان (ت 35 هـ) الذي اتخذه لنفسه يقرأ فيه – رضي الله عنه -. * المراد به الجنس، وهو ما يشمل مصحفَه رضي الله عنه وسائر المصاحف التي أرسلها إلى الأمصار، والغالب في هذه تعريفه بـ (ال)، فيقال: (المصحف الإمام) ” انتهى . ولا يُشترط في صحة القراءة أن تكون موافقة لمصحفِ عثمان رضي الله عنه الخاص ، بل أنْ توافقَ أحدَ المصاحف العثمانية كما سبق. خامسا: قال السيوطي رحمه الله في “الإتقان في علوم القرآن” (4/ 181) في بيان كيفية كتابة الكلمات المختلفة بالزيادة والنقصان في المصاحف العثمانية : ” وأمّا القراءاتُ المختلفةُ المشهورةُ بزيادةٍ لا يحتملها الرسمُ ونحوها، نحو ( أَوْصَى ) و( وَصَّى ) ، و( تَجْرِي تَحْتَها ) و( مِن تَحْتِها ) ، و ( سَيَقُولُونَ اللهُ ) و( لله ) ، و( مَا عَمِلَتْ أَيْدِيْهِمْ ) و( مَا عَمِلَتْهُ ) : فكتابتُه على نحوِ قراءتِه ، وكلُّ ذلك وُجد في مصاحفِ الإمام ” انتهى . وفصَّل ذلك الشيخ صبحي الصالح في “مباحث في علوم القرآن” (ص: 86) فقال : ” وغنيٌّ عن البيان بعد هذا أنّ كلَّ لفظٍ قرآنيٍّ لم يتواتر في قراءته أكثرُ مِن وجهٍ كان يُكتب برسمٍ واحدٍ فقط ، وأنَّ كلَّ ما صحّ فيه تواترُ أكثر مِن وجهٍ وتعذّر رسمُه في الخطِّ محتملًا لجميعِ الوجوه ، كان لا بدَّ أنْ يُلجئ الناسخينَ إلى كتابتِه في بعضِ المصاحفِ بوجهٍ ، وفي بعضِها الآخرِ بوجهٍ ثانٍ .. على أنّ هذا النوعَ الأخيرَ قليلٌ جدًّا ، وقد ذُكر محصورًا في آياتٍ معدودةٍ في أكثر الكتب المؤلفة حول المصاحف” انتهى . وقد بيّن الإمامُ ابن الجزري سببَ وجود الاختلاف اليسير بين هذه المصاحف فقال في كتابه “النشر في القراءات العشر” (1/ 32) : “لا إشكالَ أنّ الصحابةَ كتبوا في هذه المصاحف ما تحقّقوا أنه قرآنٌ وما علموه استقر في العرضة الأخيرة ، وما تحقّقوا صحتَه عن النبي صلى الله عليه وسلم مما لم يُنسخ ، وإن لم تكن داخلةً في العرضة الأخيرة ؛ ولذلك اختلفت المصاحفُ بعضَ اختلافٍ ؛ إذ لو كانت العرضةُ الأخيرة فقط لم تختلف المصاحف بزيادةٍ ونقصٍ وغير ذلك ، وتركوا ما سوى ذلك ” انتهى. وقد نقل بعضُ مَن قرأ في مصحفِ عثمانَ رضي الله عنه الخاصِّ الخلافَ بينه وبين بقية المصاحف التي انتسخها أهلُ المدينة فروى ابن أبي داود المصاحف (ص: 139) بإسناده عن خالد بن إياس بن صخر بن أبي الجَهم : “أنه قرأ مصحفَ عثمان بن عفان رضي الله عنه ، فوجد فيه مما يخالف مصاحف أهلِ المدينة اثني عشر حرفًا ، منها في البقرة: ( وَوَصَّى بِهَا إِبْرَاهِيمُ ) [البقرة: 132] ، بغير ألف، وفي آل عمران: ( وَسَارِعُوا إِلَى مَغْفِرَةٍ ) [آل عمران: 133] بالواو، وفي المائدة: ( وَيَقُولُ الَّذِينَ آمَنُوا ) [المائدة: 53] بواو، وفيها أيضًا ( مَنْ يَرْتَدَّ مِنْكُمْ ) [المائدة: 54] بدال واحدة، وفي براءة: ( وَالَّذِينَ اتَّخَذُوا مَسْجِدًا )[التوبة: 107] بواو، وفي الكهف: ( لَأَجِدَنَّ خَيْرًا مِنْهَا مُنْقَلَبًا ) [الكهف: 36] ، واحدٌ، وفي الشعراء: ( وَتَوَكَّلْ عَلَى الْعَزِيزِ ) [الشعراء: 217] بالواو، وفي المؤمن: ( أَوْ أَنْ يَظْهَرَ ) [غافر: 26] ، وفي الشورى: ( فَبِمَا كَسَبَتْ ) [الشورى: 30] بالفاء، وفي الزخرف: ( وَفِيهَا مَا تَشْتَهِي الْأَنْفُسُ ) بغير هاء، وفي الحديد: ( فَإِنَّ اللَّهَ هُوَ الْغَنِيُّ الْحَمِيدُ ) [الحديد: 24] بـ( هو )، وفي الشمس وضحاها: ( وَلَا يَخَافُ عُقْبَاهَا ) [الشمس: 15] ، بالواو ” انتهى . وينظر جواب السؤال (403914) والله أعلم.",
)
