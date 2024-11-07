import os
import shutil
from bs4 import BeautifulSoup

def html_to_text(file_path):
    """Extract text from an HTML file."""
    with open(file_path, 'r', encoding='utf-8') as file:
        soup = BeautifulSoup(file, 'html.parser')
        return soup.get_text()

def combine_html_files_in_subfolder(subfolder):
    """Combine or convert HTML files in the specified subfolder into a single text file."""
    # Get the name of the subfolder
    folder_name = os.path.basename(subfolder)

    # Output text file will be saved in the same subfolder with the subfolder's name
    output_file = os.path.join(subfolder, f"{folder_name}.txt")

    # Check if the text file already exists, skip if so
    if os.path.exists(output_file):
        print(f"Skipped: {output_file} already exists.")
        return

    # Get all HTML files in the subfolder that match the pattern .htm
    html_files = sorted([f for f in os.listdir(subfolder) if f.endswith('.htm')])

    if not html_files:
        print(f"No HTML files found in {subfolder}.")
        return

    # If only one HTML file is found, still convert it to text
    if len(html_files) == 1:
        file_name = html_files[0]
        file_path = os.path.join(subfolder, file_name)
        text = html_to_text(file_path)

        with open(output_file, 'w', encoding='utf-8') as outfile:
            outfile.write(text + "\n")
        print(f"Converted single file {file_name} to {output_file}.")
    else:
        # Combine the HTML files into a single text file
        with open(output_file, 'w', encoding='utf-8') as outfile:
            for file_name in html_files:
                file_path = os.path.join(subfolder, file_name)
                text = html_to_text(file_path)
                outfile.write(text + "\n\n")  # Separate each file's content with a new line
                print(f"Added {file_name} to {output_file}.")

        print(f"Combined HTML files have been saved to {output_file}")

def move_single_html_to_folder(parent_folder):
    """Move individual .htm files in the parent folder into their own folder."""
    for file_name in os.listdir(parent_folder):
        if file_name.endswith('.htm') and os.path.isfile(os.path.join(parent_folder, file_name)):
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

def process_all_subfolders_and_files(parent_folder):
    """Process all subfolders and individual .htm files in the parent folder and its subfolders."""
    # Move single .htm files in the parent folder into their own folders
    move_single_html_to_folder(parent_folder)

    # Traverse all subfolders (recursively, including nested subfolders)
    for root, dirs, files in os.walk(parent_folder):
        for subfolder in dirs:
            subfolder_path = os.path.join(root, subfolder)
            combine_html_files_in_subfolder(subfolder_path)

if __name__ == "__main__":
    # Get the current directory (parent folder)
    parent_folder = "E:\OneDrive\Desktop\تصدير من الشاملة\عام"
    # Process all subfolders and files in the parent folder
    process_all_subfolders_and_files(parent_folder)

    print("Processing complete.")
