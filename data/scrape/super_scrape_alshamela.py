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


def clean_book_htms(folder_path, output_base_path, csv_path):
    metadata = pd.read_csv(csv_path)
    metadata = metadata.set_index('الكتاب')

    folder_name = os.path.basename(folder_path)

    if folder_name not in metadata.index:
        print(f"Metadata not found for book: {folder_name}")
        return

    knowledge = metadata.loc[folder_name, 'العلم الشرعي']
    category = metadata.loc[folder_name, 'التصنيف']
    author = metadata.loc[folder_name, 'المؤلف']
    book_id = str(uuid.uuid4())

    target_folder = os.path.join(output_base_path, knowledge, category, folder_name)
    os.makedirs(target_folder, exist_ok=True)

    all_files = sorted([f for f in os.listdir(folder_path) if f.endswith(".htm")])
    full_text = ""
    previous_text = ""
    optional_metadata = {}
    headers = []
    headers_set = set()
    pages = defaultdict(lambda: defaultdict(list))  # Header --> Page Number ---> Page Meta Data


    # Extract optional metadata from the first eligible .htm file
    for file in all_files:
        with open(os.path.join(folder_path, file), 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html5lib')
            optional_metadata = extract_optional_metadata(soup)
            if optional_metadata:
                break

    for file in all_files:
        with open(os.path.join(folder_path, file), 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html5lib')
            main_div = soup.find('div', class_='Main')
            if not main_div:
                continue

            page_divs = main_div.find_all('div', class_='PageText')
            for page in page_divs:
                current_text = extract_text_from_page(page)
                if current_text is None or not current_text.strip():
                    continue

                # Extract page metadata
                page_head = page.find('div', class_='PageHead')
                page_title = ""
                page_number = None

                if page_head:
                    part_name_span = page_head.find('span', class_='PartName')
                    if part_name_span:
                        page_title = part_name_span.get_text(strip=True)

                    page_num_span = page_head.find('span', class_='PageNumber')
                    if page_num_span:
                        match = re.search(r"ص:\s*([٠-٩\d]+)", page_num_span.get_text())
                        if match:
                            raw_num = match.group(1)
                            try:
                                page_number = int(arabic_to_english_numerals(raw_num))
                            except:
                                pass
                
                if page_title not in headers_set:
                    headers_set.add(page_title)
                    headers.append(page_title) 
                # Add page to list
                pages[page_title][page_number].append({
                    "header_title": page_title,
                    "page_num": page_number,
                    "cleaned_text": current_text,
                    "display_elem": str(page)
                })

                # Append to full_text
                if previous_text and not ends_with_punctuation(previous_text) and starts_with_letter(current_text):
                    full_text = full_text.rstrip() + " " + current_text.lstrip()
                else:
                    full_text += "\n\n" + current_text.strip()

                previous_text = current_text

    # Normalize whitespace
    full_text = re.sub(r'\n{3,}', '\n\n', full_text).strip()

    # Save Markdown
    md_path = os.path.join(target_folder, f"{folder_name}.md")
    with open(md_path, "w", encoding="utf-8") as f_out:
        f_out.write(full_text)
    print(f"Cleaned Markdown saved to: {md_path}")

    # Save JSON
    book_info = {
        "book_id": book_id,
        "book_name": folder_name,
        "author": author,
        "knowledge": knowledge,
        "category": category,
        "headers": headers,
        **optional_metadata,
        "pages": pages
    }

    json_path = os.path.join(target_folder, f"{folder_name}.json")
    with open(json_path, "w", encoding="utf-8") as f_json:
        json.dump(book_info, f_json, ensure_ascii=False, indent=2)
    print(f"Metadata saved to: {json_path}")

def move_single_html_to_folder(parent_folder):
    """Move individual .htm files in the parent folder into their own folder."""
    for file_name in os.listdir(parent_folder):
        if file_name.endswith(".htm") and os.path.isfile(
            os.path.join(parent_folder, file_name)
        ):
            # Create a folder with the same name as the .htm file (without the extension)
            file_name_without_ext = os.path.splitext(file_name)[0]
            new_folder_path = os.path.join(parent_folder, file_name_without_ext)

            if not os.path.exists(new_folder_path):
                os.makedirs(new_folder_path)
                print(f"Created folder: {new_folder_path}")

            # Move the .htm file into the new folder
            old_file_path = os.path.join(parent_folder, file_name)
            new_file_path = os.path.join(new_folder_path, file_name)
            shutil.move(old_file_path, new_file_path)
            print(f"Moved {file_name} to {new_folder_path}")


def process_all_subfolders_and_files(parent_folder, output_base_path, csv_path):
    """Process all subfolders and individual .htm files in the parent folder and its subfolders."""
    # Move single .htm files in the parent folder into their own folders
    move_single_html_to_folder(parent_folder)

    # Traverse all subfolders (recursively, including nested subfolders)
    for root, dirs, files in os.walk(parent_folder):
        for subfolder in dirs:
            subfolder_path = os.path.join(root, subfolder)
            clean_book_htms(subfolder_path, output_base_path, csv_path)

process_all_subfolders_and_files("E:\OneDrive\Desktop\تصدير من الشاملة", "E:\OneDrive\Desktop\dev\AI-Muslim-Chatbot\data/raw_books", "E:\OneDrive\Desktop\dev\AI-Muslim-Chatbot\data\islamic_library.csv")

