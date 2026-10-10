import os
from dataclasses import dataclass

@dataclass
class LLMConfig:
    # API Endpoint & Credentials
    api_base_url: str = "http://127.0.0.1:8045/v1"
    api_key: str = "sk-c1c7dbb68c714d3399a14b05ca9906d6"
    model_name: str = "gemini-3.8-flash-high"

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
    timeout_seconds: float = 45.0
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
