
def generate_prompt(query):

    with open ("prompt.txt", "r", encoding="utf-8") as f:
        prompt = f.read()
    
    prompt += f"\n{query}"
    return prompt