from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from typing import List, Optional
from google import genai
from utils import generate_prompt
import os
import logging
import asyncio

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Gemini client
try:
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    if not client:
        raise ValueError("GEMINI_API_KEY not found in environment variables")
except Exception as e:
    logger.error(f"Failed to initialize Gemini client: {str(e)}")
    raise

app = FastAPI(
    title="Query Optimization API",
    description="API for optimizing search queries using Gemini AI",
    version="1.0.0"
)

class OptimizedQueryResponse(BaseModel):
    optimized_query: str
    sub_queries: Optional[List[str]] = None

async def process_single_query(query: str) -> List[OptimizedQueryResponse]:
    """Process a single query with error handling and logging"""
    if not query.strip():
        logger.warning("Empty query received, skipping")
        return []
    
    logger.info(f"Processing query: {query}")
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=generate_prompt(query),
            config={
                "response_mime_type": "application/json",
                "response_schema": list[OptimizedQueryResponse],
            },
        )
        
        if not response.parsed:
            logger.error(f"Empty response from Gemini for query: {query}")
            return []
            
        return response.parsed
        
    except Exception as e:
        logger.error(f"Error processing query '{query}': {str(e)}")
        return []

@app.post(
    "/optimize-query",
    response_model=List[OptimizedQueryResponse],
    responses={
        400: {"description": "Invalid input"},
        500: {"description": "Internal server error"}
    }
)
async def optimize_query(queries: List[str]):
    """
    Optimize multiple search queries concurrently using Gemini AI.
    
    Processes all queries in parallel for better performance.
    """
    if not queries:
        raise HTTPException(status_code=400, detail="No queries provided")
    
    # Filter out empty queries
    valid_queries = [q for q in queries if q.strip()]
    if not valid_queries:
        raise HTTPException(status_code=400, detail="No valid queries provided")
    
    try:
        # Process all queries concurrently
        tasks = [process_single_query(query) for query in valid_queries]
        results = await asyncio.gather(*tasks)
        
        # Flatten the results
        optimized_queries = [item for sublist in results for item in sublist]
        
        if not optimized_queries:
            raise HTTPException(status_code=500, detail="No optimized queries generated")
            
        return optimized_queries
        
    except Exception as e:
        logger.error(f"Error processing queries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))