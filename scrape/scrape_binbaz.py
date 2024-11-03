import requests
from bs4 import BeautifulSoup
import json
import time

# Base URL and maximum pages
BASE_URL = "https://binbaz.org.sa/fatwas/kind/1?page="
MAX_PAGES = 316

# Open the JSON file in append mode
with open("fatwas.json", "w", encoding="utf-8") as f:
    f.write("[")  # Start the JSON list

for page in range(1, MAX_PAGES + 1):
    url = BASE_URL + str(page)
    print(f"Processing page: {page}")
    
    try:
        response = requests.get(url)
        response.raise_for_status()  # Ensure the request was successful
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page {page}: {e}")
        continue

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Find all fatwas on the page
    fatwas = soup.find_all("article", class_="fatwa")
    
    for i, fatwa in enumerate(fatwas, start=1):
        try:
            # Get the unique URL for each fatwa
            fatwa_url = fatwa.find("h1").find("a")["href"]

            # Fetch the fatwa page
            fatwa_response = requests.get(fatwa_url)
            fatwa_response.raise_for_status()
            fatwa_soup = BeautifulSoup(fatwa_response.text, 'html.parser')

            # Extract the question from the div inside the h2
            question_h2 = fatwa_soup.find("h2", class_="article-title__question")
            question = question_h2.get_text(strip=True) if question_h2 else "Question not found."

            # Extract the answer from the div inside the article-content div
            content_div = fatwa_soup.find("div", class_="article-content")
            answer = content_div.get_text(strip=True) if content_div else "Answer not found."
            
            # Store the question and answer in a dictionary
            fatwa_dict = {
                "question": question,
                "answer": answer,
            }
            
            # Append the fatwa to the JSON file
            with open("fatwas.json", "a", encoding="utf-8") as f:
                json.dump(fatwa_dict, f, ensure_ascii=False, indent=4)
                f.write(",\n")  # Separate entries with a comma and newline

            print(f"Processed fatwa {i} on page {page}.")
        
        except (AttributeError, requests.exceptions.RequestException) as e:
            print(f"Skipping fatwa {i} on page {page} due to missing elements or error: {e}")
            continue
    
    # Sleep to prevent overwhelming the server
    time.sleep(1)

# Close the JSON list properly
with open("fatwas.json", "a", encoding="utf-8") as f:
    f.seek(f.tell() - 2, 0)  # Move to the position before the last comma
    f.write("\n]")  # Close the list

print("Scraping complete. Data saved to fatwas.json.")
