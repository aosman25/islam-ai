from typing import List, Optional
from models import AskRequest, ChatHistoryMessage, SourceData
import os
from fasttext.FastText import _FastText

DETAILED_ANSWER_MARKER = "<!-- DETAILED_ANSWER -->"


def load_prompt_template(path: str = "prompt.txt") -> str:
    """
    Load the prompt template from a file.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Prompt template not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def format_sources(sources: List[SourceData]) -> str:
    """
    Format the list of SourceData objects into an Arabic string for the prompt.
    """
    return "\n\n".join([
        f"""
        معرف المصدر: [{s.id}]
        اسم الكتاب: {s.book_name}
        المؤلف: {s.author}
        النص:
        {s.text.strip()}
        """ for i, s in enumerate(sources)
    ])

def format_chat_history(chat_history: Optional[List[ChatHistoryMessage]]) -> str:
    """
    Format chat history into a conversation block for the prompt.
    Assistant messages are truncated to avoid blowing up context.
    Returns empty string if no history.
    """
    if not chat_history:
        return ""

    lines = ["المحادثة السابقة:"]
    for msg in chat_history:
        if msg.role == "user":
            lines.append(f"المستخدم: {msg.content}")
        else:
            content = msg.content
            marker_idx = content.find(DETAILED_ANSWER_MARKER)
            if marker_idx != -1:
                content = content[:marker_idx].strip()
            lines.append(f"المساعد: {content}")
    lines.append("")  # blank line before current query
    return "\n".join(lines)

def detect_language(model: _FastText, text: str):
    """
    Detect the language of the text
    """
    # fasttext predict requires single-line input
    text = text.replace("\n", " ").strip()
    pred = model.predict(text)
    label = pred[0][0]               # "__label__hi"
    lang = label.replace("__label__", "")
    return lang


# Maps ISO 639-1 codes to (English name, native name, reinforcement instruction in that language)
LANG_MAP = {
    "ar": ("Arabic", "العربية", "يجب أن تكتب إجابتك بالكامل باللغة العربية فقط."),
    "en": ("English", "English", "You MUST write your entire response in English only."),
    "fr": ("French", "Français", "Vous DEVEZ rédiger toute votre réponse en français uniquement."),
    "de": ("German", "Deutsch", "Sie MÜSSEN Ihre gesamte Antwort ausschließlich auf Deutsch verfassen."),
    "es": ("Spanish", "Español", "DEBES escribir toda tu respuesta únicamente en español."),
    "tr": ("Turkish", "Türkçe", "Yanıtınızın tamamını yalnızca Türkçe olarak yazmalısınız."),
    "ur": ("Urdu", "اردو", "آپ کو اپنا پورا جواب صرف اردو میں لکھنا ہے۔"),
    "fa": ("Persian", "فارسی", "شما باید تمام پاسخ خود را فقط به زبان فارسی بنویسید."),
    "id": ("Indonesian", "Bahasa Indonesia", "Anda HARUS menulis seluruh jawaban Anda hanya dalam Bahasa Indonesia."),
    "ms": ("Malay", "Bahasa Melayu", "Anda MESTI menulis seluruh jawapan anda dalam Bahasa Melayu sahaja."),
    "bn": ("Bengali", "বাংলা", "আপনাকে অবশ্যই আপনার সম্পূর্ণ উত্তর শুধুমাত্র বাংলায় লিখতে হবে।"),
    "hi": ("Hindi", "हिन्दी", "आपको अपना पूरा उत्तर केवल हिंदी में लिखना होगा।"),
    "sw": ("Swahili", "Kiswahili", "Lazima uandike jibu lako lote kwa Kiswahili pekee."),
    "ru": ("Russian", "Русский", "Вы ДОЛЖНЫ написать весь свой ответ только на русском языке."),
    "zh": ("Chinese", "中文", "你必须完全用中文撰写你的回答。"),
    "ja": ("Japanese", "日本語", "回答はすべて日本語のみで記述してください。"),
    "ko": ("Korean", "한국어", "반드시 전체 답변을 한국어로만 작성해야 합니다."),
    "pt": ("Portuguese", "Português", "Você DEVE escrever toda a sua resposta apenas em português."),
    "it": ("Italian", "Italiano", "DEVI scrivere tutta la tua risposta esclusivamente in italiano."),
    "nl": ("Dutch", "Nederlands", "U MOET uw volledige antwoord uitsluitend in het Nederlands schrijven."),
}


def get_lang_info(lang_code: str) -> tuple:
    """Return (full_name, native_name, reinforcement) for a language code."""
    if lang_code in LANG_MAP:
        return LANG_MAP[lang_code]
    # Fallback: use the code itself with an English reinforcement
    return (lang_code, lang_code, f"You MUST write your entire response in {lang_code} only.")


def build_prompt(ask_request: AskRequest, query_lang: str, prompt_path: str = "prompt.txt") -> str:
    """
    Generate the full prompt by filling the template with query and formatted sources.
    """
    template = load_prompt_template(prompt_path)
    formatted_sources = format_sources(ask_request.sources)
    history_block = format_chat_history(ask_request.chat_history)
    lang_name, lang_native, lang_reinforcement = get_lang_info(query_lang)
    return template.format(
        query=ask_request.query.strip(),
        query_lang=query_lang,
        query_lang_name=lang_name,
        query_lang_native=lang_native,
        lang_reinforcement=lang_reinforcement,
        formatted_sources=formatted_sources,
        chat_history=history_block,
    )

