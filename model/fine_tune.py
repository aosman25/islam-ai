from vertexai.preview.tuning import sft
from dotenv import load_dotenv
import os

load_dotenv()


tuned_model_display_name = "muslim-chatbot"
BUCKET_URI = os.getenv("BUCKET_URI")

sft_tuning_job = sft.train(
    source_model="gemini-1.5-flash-002",
    train_dataset=f"{BUCKET_URI}/islamqa_fatwas+islamweb_fatwas_training.jsonl",
    validation_dataset=f"{BUCKET_URI}/islamqa_fatwas+islamweb_fatwas_validation.jsonl",
    tuned_model_display_name=tuned_model_display_name,
)
