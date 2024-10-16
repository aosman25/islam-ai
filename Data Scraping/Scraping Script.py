
# Import necessary libraries
from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def get_web_info(start_page=213, end_page=7564, output_file="output.txt"):
    """
    Scrapes paragraphs from a dynamically loading website and writes them to a file.

    Parameters:
    start_page (int): The starting page number for scraping.
    end_page (int): The ending page number for scraping.
    output_file (str): The name of the file to save the scraped text.
    """

    # Initialize the WebDriver (ensure ChromeDriver is installed and configured correctly)
    driver = webdriver.Chrome()

    # Loop through the specified page range
    for i in range(start_page, end_page):
        # Construct the URL for the current page
        url = f"https://ketabonline.com/ar/books/1003000/read?part=1&page={i}"
        driver.get(url)  # Load the page
        print(f"Scraping page {i}: {url}")

        # Wait for the page to fully load (adjust time based on network speed)
        time.sleep(4)

        # Find all <p> elements with the desired class name (modify if the website changes structure)
        paragraphs = driver.find_elements(By.CLASS_NAME, "g-paragraph")

        # Open a file to save the text (append mode to prevent overwriting)
        with open(output_file, "a", encoding="utf-8") as file:
            # Iterate through found paragraphs and write non-empty text to the file
            for p in paragraphs:
                text = p.text
                if text.strip():  # Ensure non-empty text is written
                    file.write(text + "\n")

    # Close the browser after scraping
    driver.quit()

# Call the function with default parameters
get_web_info()
