from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def get_web_info(book_id, start_page=1, output_file="output.txt"):
    """
    Scrapes paragraphs from a dynamically loading website and writes them to a file.
    The scraping stops when no more paragraphs with the specified class are found on a page,
    which is used as an indication of the last page.

    Parameters:
    book_id (int): The unique identifier of the book to scrape.
    start_page (int): The starting page number for scraping. Defaults to 1.
    output_file (str): The name of the file where the scraped text will be saved. Defaults to "output.txt".
    """

    # Initialize the WebDriver (ChromeDriver must be installed and set up correctly in your environment)
    driver = webdriver.Chrome()

    # Initialize the page counter starting from the provided start_page
    current_page = start_page

    while True:
        # Construct the URL for the current page by injecting the book_id and page number
        url = f"https://ketabonline.com/ar/books/{book_id}/read?page={current_page}"
        driver.get(url)  # Load the current page
        print(f"Scraping page {current_page}: {url}")

        # Wait for the page to fully load before extracting content (time can be adjusted based on network speed)
        time.sleep(4)

        # Find all <p> elements with the class name 'g-paragraph' that contain the main content
        paragraphs = driver.find_elements(By.CLASS_NAME, "g-paragraph")

        # If no paragraphs are found, assume we've reached the last page and exit the loop
        if not paragraphs:
            print(f"No more paragraphs found on page {current_page}. Stopping...")
            break

        # Open the output file in append mode ('a'), to add new content without overwriting existing data
        with open(output_file, "a", encoding="utf-8") as file:
            # Iterate through the paragraphs found and write their non-empty text to the file
            for p in paragraphs:
                text = p.text
                if text.strip():  # Check if the text is not empty or just whitespace
                    file.write(text + "\n")  # Write the paragraph text, followed by a newline

        # Move on to the next page
        current_page += 1

    # Close the WebDriver and terminate the browser session after scraping is complete
    driver.quit()

# Example usage with a specific book_id; you can change the book_id as needed
book_id = 1535
get_web_info(book_id)
