from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from google import genai
from google.genai import types
from utils import build_prompt
from models import AskRequest
import os

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Gemini Chat API",
    description="API for streaming responses from Google's Gemini model",
    version="1.0.0"
)

with open("system_instruction.txt", "r", encoding="utf-8") as f:
    system_instruction = f.read()

def get_gemini_client() -> genai.Client:
    """Initialize and return the Gemini API client."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing Gemini API key.")
    return genai.Client(api_key=api_key)


@app.post("/ask", response_class=StreamingResponse, tags=["Chat"])
def ask(request: AskRequest, client: genai.Client = Depends(get_gemini_client)):
    """
    Stream response from Gemini model based on user input and sources.
    Optional generation parameters: temperature, max_tokens.
    """
    try:
        prompt = build_prompt(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building prompt: {str(e)}")

    def stream_response():
        try:
            response = client.models.generate_content_stream(
                model=os.getenv("MODEL", "gemini-pro"),
                contents=[prompt],
                config=types.GenerateContentConfig(
                    temperature= request.temperature,
                    system_instruction=system_instruction
                )
            )
            for chunk in response:
                if hasattr(chunk, "text"):
                    yield chunk.text
        except Exception as e:
            yield f"[ERROR]: {str(e)}"

    return StreamingResponse(stream_response(), media_type="text/plain")
