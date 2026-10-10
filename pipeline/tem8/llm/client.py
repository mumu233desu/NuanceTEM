import asyncio
import json
import random
import aiohttp
from typing import Dict, List, Optional
from .config import CONFIG
from .cache import ResponseCache

class LLMClient:
    """
    基于 aiohttp 的异步并发调用器。
    集成：4并发信号量限制、指数退避重试、超时中断、SHA-256 智能缓存。
    """
    def __init__(self, concurrency: int = CONFIG.default_concurrency):
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)
        self.cache = ResponseCache()
        self.api_url = f"{CONFIG.api_base_url.rstrip('/')}/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {CONFIG.api_key}",
            "Content-Type": "application/json"
        }

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = CONFIG.temperature,
        max_tokens: int = CONFIG.max_tokens,
        use_cache: bool = True
    ) -> str:
        # 1. 检查缓存
        cache_key = self.cache.make_key(CONFIG.model_name, messages, temperature)
        if use_cache:
            cached_resp = self.cache.get(cache_key)
            if cached_resp is not None:
                return cached_resp

        payload = {
            "model": CONFIG.model_name,
            "messages": messages,
            "temperature": temperature,
            "top_p": CONFIG.top_p,
            "max_tokens": max_tokens
        }

        # 2. 并发限流调度与指数退避重试
        async with self.semaphore:
            last_err = None
            for attempt in range(1, CONFIG.max_retries + 1):
                try:
                    timeout = aiohttp.ClientTimeout(total=CONFIG.timeout_seconds)
                    async with aiohttp.ClientSession(timeout=timeout) as session:
                        async with session.post(self.api_url, headers=self.headers, json=payload) as resp:
                            if resp.status == 200:
                                res_json = await resp.json()
                                content = res_json["choices"][0]["message"]["content"]
                                if use_cache:
                                    self.cache.set(cache_key, content)
                                return content
                            else:
                                err_text = await resp.text()
                                last_err = f"HTTP {resp.status}: {err_text[:200]}"
                except asyncio.TimeoutError:
                    last_err = f"Request timed out after {CONFIG.timeout_seconds}s"
                except Exception as e:
                    last_err = f"Exception: {str(e)}"

                if attempt < CONFIG.max_retries:
                    # 指数退避加随机扰动 (Jitter)
                    sleep_time = (CONFIG.retry_delay_base ** attempt) + random.uniform(0.1, 0.5)
                    await asyncio.sleep(sleep_time)

            raise RuntimeError(f"LLM API call failed after {CONFIG.max_retries} attempts: {last_err}")
