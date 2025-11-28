from typing import List
from models import AskRequest, SourceData
import os
from fasttext.FastText import _FastText

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
        اسم الكتاب: {s.book_name}
        المؤلف: {s.author}
        الصفحات: {s.page_range}
        العناوين الفرعية: {", ".join(s.header_titles)}
        التصنيف: {s.category}
        النص:
        {s.text.strip()}
        """ for i, s in enumerate(sources)
    ])

def detect_language(model: _FastText, text: str):
    """
    Detect the language of the text
    """
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
    return template.format(query=ask_request.query.strip(), query_lang=query_lang, formatted_sources=formatted_sources)

