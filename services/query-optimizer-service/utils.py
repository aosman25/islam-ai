from typing import Dict, List

# Higher-order categories that the LLM selects from,
# mapped to the actual PostgreSQL category names stored in Milvus.
CATEGORY_MAP: Dict[str, List[str]] = {
    "العقيدة": [
        "العقيدة",
        "الفرق والردود",
        "كتب السنة",
        "الجوامع",
    ],
    "التفسير": [
        "التفسير",
        "علوم القرآن وأصول التفسير",
    ],
     "التجويد والقراءات":[
        "التجويد والقراءات"
     ],
    "كتب الحديث و الشروح": [
        "كتب السنة",
        "شروح الحديث",
        "التخريج والأطراف",
    ],
    "علوم الحديث والعلل":[
        "العلل والسؤلات الحديثية",
        "علوم الحديث",
    ],
    "الفقة": [
        "أصول الفقه",
        "علوم الفقه والقواعد الفقهية",
        "الفقه الحنفي",
        "الفقه المالكي",
        "الفقه الشافعي",
        "الفقه الحنبلي",
        "الفقه العام",
        "مسائل فقهية",
        "السياسة الشرعية والقضاء",
        "الفرائض والوصايا",
        "الفتاوى",
        "الجوامع",
    ],
    "السيرة النبوية": [
        "السيرة النبوية",
    ],
    "التاريخ": [
        "التاريخ",
    ],
    "التراجم والطبقات": [
        "التراجم والطبقات",
    ],
    "اللغة والأدب": [
        "الغريب والمعاجم",
        "النحو والصرف",
        "الأدب",
    ],
}


def get_higher_order_categories() -> List[str]:
    """Return the list of higher-order category names for the prompt."""
    return list(CATEGORY_MAP.keys())


def resolve_categories(higher_order: List[str]) -> List[str]:
    """Resolve higher-order category names to actual PostgreSQL category names."""
    resolved = []
    for name in higher_order:
        if name in CATEGORY_MAP:
            resolved.extend(CATEGORY_MAP[name])
    return resolved



def generate_prompt(query: str) -> str:
    with open("prompt.txt", "r", encoding="utf-8") as f:
        prompt = f.read()

    categories = get_higher_order_categories()
    categories_text = "\n".join(f"  - {cat}" for cat in categories)
    prompt = prompt.replace("{categories}", categories_text)
    prompt += f"\n{query}"
    return prompt
