import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    # Load .env from project root
    _proj_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    _env_path = os.path.join(_proj_root, ".env")
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
    else:
        load_dotenv()
except Exception:
    pass

@dataclass
class LLMConfig:
    # API Endpoint & Credentials
    api_base_url: str = os.getenv("LLM_API_BASE_URL", "http://127.0.0.1:8045/v1")
    api_key: str = os.getenv("LLM_API_KEY", "")
    model_name: str = os.getenv("LLM_MODEL_NAME", "gemini-3.8-flash-high")

    # Generation Hyperparameters
    # 低温度 (0.3) 确保严谨的学术外刊句式、介词搭配不产生幻觉漂移，并稳定输出标准 JSON
    temperature: float = 0.3
    top_p: float = 0.95
    max_tokens: int = 3500

    # Reviewer Hyperparameters
    # 审校温度 (0.1) 确保批判性评估客观苛刻、排他性检查高度一致
    reviewer_temperature: float = 0.1

    # Concurrency & Networking
    default_concurrency: int = 4
    default_batch_concurrency: int = 4
    timeout_seconds: float = 180.0
    stream: bool = True
    ttft_timeout: float = 60.0
    idle_chunk_timeout: float = 25.0
    max_retries: int = 3
    retry_delay_base: float = 2.0

    # Paths
    base_dir: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    corpus_dir: str = os.path.join(base_dir, "corpus")
    syllabus_cache_file: str = os.path.join(corpus_dir, "syllabus_cache.json")
    mw_cache_file: str = os.path.join(corpus_dir, "mw_cache.json")
    cache_dir: str = os.path.join(base_dir, ".cache")
    llm_cache_file: str = os.path.join(cache_dir, "llm_cache.json")
    chunks_dir: str = os.path.join(base_dir, "chunks")
    batches_dir: str = os.path.join(base_dir, "batches")
    state_dir: str = os.path.join(base_dir, "state")
    batches_state_file: str = os.path.join(state_dir, "batches_state.json")

# Default Global Instance
CONFIG = LLMConfig()
