import requests
from bs4 import BeautifulSoup
import json

def scrape_fatwas():
    base_url = "https://islamqa.info/ar/latest?page="
    fatwas_list = []  # List to store all fatwas
    
    for page in range(1, 15):  # Loop through pages 1 to 14
        url = base_url + str(page)
        response = requests.get(url)

        if response.status_code != 200:
            print(f"Failed to retrieve page {page}: Status code {response.status_code}")
            continue

        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find all fatwa cards
        fatwa_cards = soup.find_all('a', class_='post-card')
        
        for index, card in enumerate(fatwa_cards):
            # Get the fatwa link
            fatwa_link = card['href']
            fatwa_response = requests.get(fatwa_link)

            if fatwa_response.status_code != 200:
                print(f"Failed to retrieve fatwa: {fatwa_link}")
                continue
            
            fatwa_soup = BeautifulSoup(fatwa_response.content, 'html.parser')
            
            # Attempt to extract the question
            try:
                question_section = fatwa_soup.find('section', class_='single_fatwa__question')
                question = question_section.find('p').get_text(strip=True) if question_section else "No question found"

                # Attempt to extract the answer
                answer_div = fatwa_soup.find('div', class_='content')
                answer = " ".join(paragraph.get_text(strip=True) for paragraph in answer_div.find_all('p')) if answer_div else "No answer found"

                # Create the fatwa dictionary
                fatwa = {"question": question, "answer": answer}
                fatwas_list.append(fatwa)  # Append the fatwa to the list

                # Print the current status
                print(f"Page {page}, Fatwa {index + 1}: '{question}'")

            except Exception as e:
                print(f"Error processing fatwa: {fatwa_link}, Error: {str(e)}")
                continue  # Skip to the next fatwa if an error occurs

    # Save the list of fatwas to JSON file
    with open('fatwas.json', 'w', encoding='utf-8') as json_file:
        json.dump(fatwas_list, json_file, ensure_ascii=False, indent=4)

    print("Scraping complete. Total fatwas saved:", len(fatwas_list))

if __name__ == "__main__":
    scrape_fatwas()
