from openai import OpenAI
from dotenv import load_dotenv
import os

# Load Environment Variables
load_dotenv()


def get_chat_response(
    user_message,
    model="chatbotmuslim/aya-muslim-v1-gptq",
    temperature=0.3,
    max_tokens=8000,
    stream=True,
    output_file="chat_response.txt",
):
    client = OpenAI(base_url=os.getenv("MODEL_URL"), api_key=os.getenv("MODEL_API_KEY"))

    completion = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": user_message}],
        temperature=temperature,
        max_tokens=max_tokens,
        stream=stream,
    )

    with open(output_file, "w", encoding="utf-8") as file:
        if stream:
            for chunk in completion:
                if (
                    chunk.choices
                    and chunk.choices[0].delta
                    and chunk.choices[0].delta.content
                ):
                    file.write(chunk.choices[0].delta.content)
                    file.flush()  # Ensure content is written in real-time
        else:
            file.write(completion.choices[0].message.content)

    print(f"Response saved to {output_file}")


user_message = "اكتب شعر عن الام"
# Get and print response
response = get_chat_response(user_message)
