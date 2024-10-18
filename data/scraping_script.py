import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time
from concurrent.futures import ThreadPoolExecutor

def get_web_info(book_id, start_page=1, output_dir="books", output_file=None, log_file="scraping_log.txt"):
    """
    Scrapes paragraphs from a dynamically loading website for a given book_id.
    Stops when no more paragraphs are found on a page.

    Parameters:
    book_id (int): The unique identifier of the book to scrape.
    start_page (int): The starting page number for scraping. Defaults to 1.
    output_dir (str): The directory where output files will be saved. Defaults to 'books'.
    output_file (str): The name of the file where the scraped text will be saved.
                       Defaults to 'output_{book_id}.txt'.
    log_file (str): The file where the last page scraped for each book will be logged.
    """

    # Create the 'books' directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Set default output file if not provided
    if output_file is None:
        output_file = os.path.join(output_dir, f"book_{book_id}.txt")

    # Initialize the WebDriver (ChromeDriver must be installed and set up correctly in your environment)
    driver = webdriver.Chrome()

    # Initialize the page counter
    current_page = start_page
    last_scraped_page = 0

    try:
        while True:
            # Construct the URL for the current page
            url = f"https://ketabonline.com/ar/books/{book_id}/read?page={current_page}"
            driver.get(url)  # Load the page
            print(f"Scraping book {book_id}, page {current_page}: {url}")

            try:
                # Wait until the 'g-paragraph' elements are found (or timeout after 120 seconds)
                WebDriverWait(driver, 1200).until(EC.presence_of_element_located((By.CLASS_NAME, "g-paragraph")))
            except TimeoutException:
                print(f"Timeout waiting for page {current_page} to load for book {book_id}.")
                break  # If the page doesn't load within 120 seconds, assume no more content

            # Find all <p> elements with the class name 'g-paragraph' that contain the main content
            paragraphs = driver.find_elements(By.CLASS_NAME, "g-paragraph")

            # If no paragraphs are found, assume we've reached the last page and exit the loop
            if not paragraphs:
                print(f"No more paragraphs found for book {book_id} on page {current_page}. Stopping...")
                break

            # Open the output file in append mode ('a'), to add new content without overwriting existing data
            with open(output_file, "a", encoding="utf-8") as file:
                # Iterate through the paragraphs found and write their non-empty text to the file
                for p in paragraphs:
                    text = p.text
                    if text.strip():  # Check if the text is not empty or just whitespace
                        file.write(text + "\n")  # Write the paragraph text, followed by a newline

            # Update the last scraped page
            last_scraped_page = current_page

            # Move to the next page
            current_page += 1

    finally:
        # Log the last scraped page for the book
        with open(log_file, "a", encoding="utf-8") as log:
            log.write(f"Book ID: {book_id}, Last Scraped Page: {last_scraped_page}\n")

        # Close the WebDriver and terminate the browser session after scraping is complete
        driver.quit()

def scrape_multiple_books(book_ids, start_page=1, output_dir="books", log_file="scraping_log.txt"):
    """
    Scrapes multiple books in parallel using threads.

    Parameters:
    book_ids (list): A list of book_ids to scrape.
    start_page (int): The starting page for scraping each book. Defaults to 1.
    output_dir (str): The directory where output files will be saved. Defaults to 'books'.
    log_file (str): The file where the last page scraped for each book will be logged.
    """

    # Use ThreadPoolExecutor to run scraping for each book in parallel
    with ThreadPoolExecutor() as executor:
        # For each book_id, submit a separate task to run the get_web_info function
        for book_id in book_ids:
            executor.submit(get_web_info, book_id, start_page, output_dir, None, log_file)

if __name__ == "__main__":
    # List of book_ids to scrape (example)
    books_to_scrape = [6315, 5921, 1557, 5925, 1529, 96961, 5968, 4012, 550]  # Add more book_ids as needed

    # Start scraping multiple books in parallel and save in the 'books' folder
    scrape_multiple_books(books_to_scrape)
