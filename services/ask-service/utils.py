from typing import List, Optional
from models import AskRequest, ChatHistoryMessage, SourceData
import os
from fasttext.FastText import _FastText

ASSISTANT_CONTENT_MAX_CHARS = 500


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
            if len(content) > ASSISTANT_CONTENT_MAX_CHARS:
                content = content[:ASSISTANT_CONTENT_MAX_CHARS] + "..."
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

def build_prompt(ask_request: AskRequest, query_lang: str, prompt_path: str = "prompt.txt") -> str:
    """
    Generate the full prompt by filling the template with query and formatted sources.
    """
    template = load_prompt_template(prompt_path)
    formatted_sources = format_sources(ask_request.sources)
    history_block = format_chat_history(ask_request.chat_history)
    return template.format(
        query=ask_request.query.strip(),
        query_lang=query_lang,
        formatted_sources=formatted_sources,
        chat_history=history_block,
    )

