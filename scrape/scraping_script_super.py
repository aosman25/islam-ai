import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from concurrent.futures import ThreadPoolExecutor

def create_driver():
    """Create a headless Chrome WebDriver instance."""
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in headless mode
    chrome_options.add_argument("--no-sandbox")  # Bypass OS security model
    chrome_options.add_argument("--disable-dev-shm-usage")  # Overcome limited resource problems

    driver = webdriver.Chrome(service=ChromeService(), options=chrome_options)
    return driver

def scrape_page(book_id, page_number):
    """Scrapes text from a single page."""
    url = f"https://ketabonline.com/ar/books/{book_id}/read?page={page_number}"
    print(f"Scraping book {book_id}, page {page_number}: {url}")
    
    driver = create_driver()
    driver.get(url)
    
    try:
        # Wait for the 'g-paragraph' elements to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "g-paragraph"))
        )
        
        # Find all <p> elements with the class name 'g-paragraph'
        paragraphs = driver.find_elements(By.CLASS_NAME, "g-paragraph")
        text_content = [p.text for p in paragraphs if p.text.strip()]  # Filter out empty text
        
        return page_number, '\n'.join(text_content)  # Return the page number and its text
    except TimeoutException:
        print(f"Timeout waiting for page {page_number} to load for book {book_id}.")
        return page_number, None  # Return None if there's a timeout
    finally:
        driver.quit()

def get_web_info(book_id, start_page=1, end_page=None, output_dir="books", output_file=None):
    """Scrapes paragraphs from a dynamically loading website for a given book_id."""
    
    # Create the 'books' directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Set default output file if not provided
    if output_file is None:
        output_file = os.path.join(output_dir, f"book_{book_id}.txt")
    
    # Create a list of pages to scrape
    pages_to_scrape = range(start_page, end_page + 1)

    # Use ThreadPoolExecutor to scrape all pages in parallel
    with ThreadPoolExecutor() as executor:
        results = list(executor.map(lambda page: scrape_page(book_id, page), pages_to_scrape))

    # Create a dictionary to store the text for each page
    text_dict = {page: text for page, text in results if text is not None}

    # Write the sorted content to the output file
    with open(output_file, "w", encoding="utf-8") as file:
        for page in sorted(text_dict.keys()):
            file.write(text_dict[page] + "\n")  # Write the text for each page

if __name__ == "__main__":
    # Dictionary of book_ids and their page ranges
    books_to_scrape = {
        5866: (16615, 48569),  # تفسير الطبري      
    }
    
    # Start scraping each book in the specified range
    for book_id, (start_page, end_page) in books_to_scrape.items():
        get_web_info(book_id, start_page, end_page)
