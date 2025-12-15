import os
import shutil
import re
from bs4 import BeautifulSoup
from bs4 import NavigableString, Tag
import pandas as pd
import json
import uuid
from collections import defaultdict



def ends_with_punctuation(text):
    return text.strip().endswith(('.', '؟', '?', '!', '***' , '»', ']', '"'))

def starts_with_letter(text):
    return bool(re.match(r"^[\u0621-\u064Aa-zA-Z]", text.strip()))

def extract_optional_metadata(soup):
    main_div = soup.find('div', class_='Main')
    if not main_div:
        return {}

    for page_div in main_div.find_all('div', class_='PageText'):
        page_head = page_div.find('div', class_='PageHead')
        if page_head and page_head.find('span', class_='PageNumber'):
            continue  # skip normal pages

        metadata = {}

        arabic_to_english = {
            "المحقق": "editor",
            "الطبعة": "edition",
            "الناشر": "publisher",
            "عدد الأجزاء": "num_volumes",
            "عدد الصفحات": "num_pages",
            "تاريخ النشر بالشاملة": "shamela_pub_date",
            "المؤلف": "author_full",
        }

        # Loop through <p> elements inside the page
        for p in page_div.find_all('p'):
            # Each key is inside <span class="title"> and value is the rest
            title_span = p.find('span', class_='title')
            if title_span:
                key_ar = title_span.get_text(strip=True).replace(":", "")
                key_en = arabic_to_english.get(key_ar)
                if key_en:
                    # Remove the <span class="title"> from the paragraph
                    title_span.extract()
                    value = p.get_text(strip=True)
                    metadata[key_en] = value

        return metadata

    return {}

def extract_text_from_page(page_div):
    page_head = page_div.find('div', class_='PageHead')
    if not page_head or not page_head.find('span', class_='PageNumber'):
        return None

    content = ""

    def process_element(elem):
        nonlocal content

        if isinstance(elem, Tag) and page_head in elem.parents:
            return
        if isinstance(elem, Tag) and elem.name == 'div' and 'footnote' in elem.get('class', []):
            return
        if isinstance(elem, Tag) and elem.name == 'sup':
            return

        if isinstance(elem, NavigableString):
            text = elem.strip()
            if not text:
                return
            text = re.sub(r"(?<!^)\(\d+\)", "", text)
            text = re.sub(r"(?<!^)\[\d+\]", "", text)
            text = re.sub(r"⦗ص:\s*\d+⦘", "", text)
            content += text + " "

        elif isinstance(elem, Tag):
            if elem.name == "span" and 'title' in elem.get('class', []):
                text = elem.get_text(strip=True)
                if not text:
                    return
                content += "**" + text + "**" + " "
            elif elem.name == 'p':
                content += "\n\n"
            else:
                for child in elem.contents:
                    process_element(child)

    for child in page_div:
        process_element(child)

    return content.strip()


def arabic_to_english_numerals(ar_num):
    """Convert Arabic-Indic digits to English digits."""
    arabic_digits = '٠١٢٣٤٥٦٧٨٩'
    trans_table = str.maketrans(arabic_digits, '0123456789')
    return ar_num.translate(trans_table)

