from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def get_web_info(book_id, start_page=1, output_file="output.txt"):
    """
    Scrapes paragraphs from a dynamically loading website and writes them to a file.
    Stops when no more paragraphs are found on a page.

    Parameters:
    start_page (int): The starting page number for scraping.
    output_file (str): The name of the file to save the scraped text.
    """

    # Initialize the WebDriver (ensure ChromeDriver is installed and configured correctly)
    driver = webdriver.Chrome()

    # Initialize the page counter
    current_page = start_page

    while True:
        # Construct the URL for the current page
        url = f"https://ketabonline.com/ar/books/{book_id}/read?page={current_page}"
        driver.get(url)  # Load the page
        print(f"Scraping page {current_page}: {url}")

        # Wait for the page to fully load (adjust time based on network speed)
        time.sleep(4)

        # Find all <p> elements with the desired class name
        paragraphs = driver.find_elements(By.CLASS_NAME, "g-paragraph")

        # If no paragraphs are found, we've reached the last page
        if not paragraphs:
            print(f"No more paragraphs found on page {current_page}. Stopping...")
            break

        # Open a file to save the text (append mode to prevent overwriting)
        with open(output_file, "a", encoding="utf-8") as file:
            # Iterate through found paragraphs and write non-empty text to the file
            for p in paragraphs:
                text = p.text
                if text.strip():  # Ensure non-empty text is written
                    file.write(text + "\n")

        # Move to the next page
        current_page += 1

    # Close the browser after scraping
    driver.quit()



# Call the function with default parameters
get_web_info()
