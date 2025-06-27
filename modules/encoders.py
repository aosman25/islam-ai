import openai
import tiktoken
from typing import List, Optional, Union
import asyncio
import logging
from time import sleep
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class DeepInfraEncoder(BaseModel):
    client: Optional[openai.Client] = None
    async_client: Optional[openai.AsyncClient] = None
    dimensions: Union[int, None] = None
    token_limit: int = 8192  # Token limit
    type: str = "deepinfra"
    max_retries: int = 3
    name: Optional[str] = None
    deepinfra_base_url: Optional[str] = "https://api.deepinfra.com/v1/openai"
    deepinfra_api_key: Optional[str] = None
    score_threshold: Optional[float] = None

    _token_encoder: Optional[tiktoken.Encoding] = None  # Regular class attribute

    class Config:
        arbitrary_types_allowed = True  # Allow arbitrary types like openai.Client
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Initialize the DeepInfra API client
        if self.deepinfra_api_key is None:
            raise ValueError("DeepInfra API key cannot be 'None'.")
        
        try:
            self.client = openai.Client(api_key=self.deepinfra_api_key, base_url=self.deepinfra_base_url)
            self.async_client = openai.AsyncClient(api_key=self.deepinfra_api_key, base_url=self.deepinfra_base_url)
        except Exception as e:
            raise ValueError(f"DeepInfra API client failed to initialize. Error: {e}") from e
        
        # Initialize dimensions if necessary
        if self.dimensions is None:
            self.dimensions = 1536  # Set default dimensions (adjust as necessary)
        
        # Initialize the tokenizer for the model (using tiktoken)
        try:
            self._token_encoder = tiktoken.get_encoding("cl100k_base")  # You can choose another encoding
        except KeyError as e:
            logger.error(f"Error getting tokenizer for model {self.name}: {e}")
            raise ValueError(f"Could not get tokenizer for the model {self.name}") from e

    def _truncate(self, text: str) -> str:
        """Truncate text to fit within token limit."""
        tokens = self._token_encoder.encode_ordinary(text)
        if len(tokens) > self.token_limit:
            logger.warning(
                f"Document exceeds token limit: {len(tokens)} > {self.token_limit}. Truncating..."
            )
            text = self._token_encoder.decode(tokens[:self.token_limit - 1])  # Keep one token buffer
            logger.info(f"Trunc length: {len(self._token_encoder.encode(text))}")
            return text
        return text

    def _tokenize_and_truncate(self, docs: List[str], truncate: bool) -> List[str]:
        """Tokenize and truncate documents if necessary."""
        if truncate:
            return [self._truncate(doc) for doc in docs]
        return docs

    def __call__(self, docs: List[str], truncate: bool = True) -> List[List[float]]:
        """Encode a list of text documents into embeddings using DeepInfra API."""
        if self.client is None:
            raise ValueError("DeepInfra client is not initialized.")
        
        # Tokenize and truncate if necessary
        docs = self._tokenize_and_truncate(docs, truncate)

        embeds = None
        for j in range(self.max_retries + 1):
            try:
                embeds = self.client.embeddings.create(
                    input=docs,
                    model=self.name,
                    encoding_format="float",
                )
                if embeds.data:
                    break
            except openai.error.OpenAIError as e:
                logger.error("Exception occurred", exc_info=True)
                if self.max_retries != 0 and j < self.max_retries:
                    sleep(2**j)
                    logger.warning(f"Retrying in {2**j} seconds due to OpenAIError: {e}")
                else:
                    raise
            except Exception as e:
                logger.error(f"DeepInfra API call failed. Error: {e}")
                raise ValueError(f"DeepInfra API call failed. Error: {str(e)}") from e
        
        if not embeds or not embeds.data:
            logger.info(f"Returned embeddings: {embeds}")
            raise ValueError("No embeddings returned.")
        
        embeddings = [embeds_obj.embedding for embeds_obj in embeds.data]
        return embeddings

    async def acall(self, docs: List[str], truncate: bool = True) -> List[List[float]]:
        """Asynchronous version of the `__call__` method."""
        if self.async_client is None:
            raise ValueError("DeepInfra async client is not initialized.")
        
        # Tokenize and truncate if necessary
        docs = self._tokenize_and_truncate(docs, truncate)

        embeds = None
        for j in range(self.max_retries + 1):
            try:
                embeds = await self.async_client.embeddings.create(
                    input=docs,
                    model=self.name,
                    encoding_format="float",
                )
                if embeds.data:
                    break
            except openai.error.OpenAIError as e:
                logger.error("Exception occurred", exc_info=True)
                if self.max_retries != 0 and j < self.max_retries:
                    await asyncio.sleep(2**j)
                    logger.warning(f"Retrying in {2**j} seconds due to OpenAIError: {e}")
                else:
                    raise
            except Exception as e:
                logger.error(f"DeepInfra API call failed. Error: {e}")
                raise ValueError(f"DeepInfra API call failed. Error: {str(e)}") from e
        
        if not embeds or not embeds.data:
            logger.info(f"Returned embeddings: {embeds}")
            raise ValueError("No embeddings returned.")
        
        embeddings = [embeds_obj.embedding for embeds_obj in embeds.data]
        return embeddings
