import openai
import tiktoken
import asyncio
import logging
from typing import List, Optional
from time import sleep
from semantic_router.encoders import DenseEncoder

logger = logging.getLogger(__name__)


class DeepInfraEncoder(DenseEncoder):
    deepinfra_api_key: str
    deepinfra_base_url: str = "https://api.deepinfra.com/v1/openai"
    token_limit: int = 8192
    max_retries: int = 3
    dimensions: int = 1536

    client: Optional[openai.Client] = None
    async_client: Optional[openai.AsyncClient] = None
    _token_encoder: Optional[tiktoken.Encoding] = None

    def model_post_init(self, __context) -> None:
        if not self.deepinfra_api_key:
            raise ValueError("DeepInfra API key cannot be empty")

        self.client = openai.Client(
            api_key=self.deepinfra_api_key,
            base_url=self.deepinfra_base_url,
        )
        self.async_client = openai.AsyncClient(
            api_key=self.deepinfra_api_key,
            base_url=self.deepinfra_base_url,
        )

        self._token_encoder = tiktoken.get_encoding("cl100k_base")

    def _truncate(self, text: str) -> str:
        tokens = self._token_encoder.encode_ordinary(text)
        if len(tokens) > self.token_limit:
            logger.warning(
                f"Document exceeds token limit {len(tokens)} > {self.token_limit}, truncating"
            )
            return self._token_encoder.decode(tokens[: self.token_limit - 1])
        return text

    def _prepare_docs(self, docs: List[str]) -> List[str]:
        return [self._truncate(doc) for doc in docs]

    def __call__(self, docs: List[str]) -> List[List[float]]:
        docs = self._prepare_docs(docs)

        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.embeddings.create(
                    input=docs,
                    model=self.name,
                    encoding_format="float",
                )
                if response.data:
                    return [obj.embedding for obj in response.data]
            except openai.error.OpenAIError as e:
                if attempt < self.max_retries:
                    backoff = 2 ** attempt
                    logger.warning(f"Retrying embedding call in {backoff}s: {e}")
                    sleep(backoff)
                else:
                    raise
            except Exception as e:
                raise RuntimeError(f"DeepInfra embedding failed: {e}") from e

        raise RuntimeError("No embeddings returned from DeepInfra")

    async def acall(self, docs: List[str]) -> List[List[float]]:
        docs = self._prepare_docs(docs)

        for attempt in range(self.max_retries + 1):
            try:
                response = await self.async_client.embeddings.create(
                    input=docs,
                    model=self.name,
                    encoding_format="float",
                )
                if response.data:
                    return [obj.embedding for obj in response.data]
            except openai.error.OpenAIError as e:
                if attempt < self.max_retries:
                    backoff = 2 ** attempt
                    logger.warning(f"Retrying async embedding call in {backoff}s: {e}")
                    await asyncio.sleep(backoff)
                else:
                    raise
            except Exception as e:
                raise RuntimeError(f"DeepInfra async embedding failed: {e}") from e

        raise RuntimeError("No embeddings returned from DeepInfra")
