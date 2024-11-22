import os
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

def scrape_book(book_id, start_page, end_page, log_file):
    # Create a directory for books if it doesn't exist
    directory = 'books'
    if not os.path.exists(directory):
        os.makedirs(directory)

    # Define the output file path
    output_file = os.path.join(directory, f'book_{book_id}.txt')

    for page_number in range(start_page, end_page + 1):
        url = f"https://shamela.ws/book/{book_id}/{page_number}"
        print(f"Scraping page {page_number} of book {book_id}...")  # Print statement for tracking

        response = requests.get(url)

        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            div_nass = soup.find('div', class_='nass')
            if div_nass:
                paragraphs = div_nass.find_all('p')  # Assuming paragraphs are inside <p> tags
                print(f"Found {len(paragraphs)} paragraphs on page {page_number} of book {book_id}.")  # Print number of paragraphs found

                # Append paragraphs to the output file after scraping each page
                with open(output_file, 'a', encoding='utf-8') as file:
                    for p in paragraphs:
                        file.write(p.get_text() + "\n")  # Write each paragraph in a new line
            else:
                print(f"No 'nass' class found on page {page_number} of book {book_id}.")
        else:
            print(f"Failed to retrieve page {page_number} of book {book_id}. Status code: {response.status_code}")

    # Log completion of the book scraping
    with open(log_file, 'a', encoding='utf-8') as log:
        log.write(f"Scraping completed for book {book_id}. Output saved to {output_file}\n")

def scrape_multiple_books(book_info):
    # Create a log file
    log_file = 'scrape_log.txt'
    with open(log_file, 'w', encoding='utf-8') as log:
        log.write("Scraping Log\n")
        log.write("=============\n")

    with ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(scrape_book, book_id, start_page, end_page, log_file): book_id
            for book_id, (start_page, end_page) in book_info.items()
        }
        
        for future in as_completed(futures):
            book_id = futures[future]
            try:
                future.result()  # This will raise an exception if the function call failed
            except Exception as e:
                print(f"Error occurred while scraping book {book_id}: {e}")

# Example usage:
book_info = {
    22835: (1229, 6474),  # Book ID 22835, pages 1229 to 6474
    23631: (1, 4837),     # Book ID 23631, pages 1 to 4837
    # Add more books as needed
}

scrape_multiple_books(book_info)
