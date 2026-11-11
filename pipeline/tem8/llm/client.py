import asyncio
import json
import random
import time
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
        self._session: Optional[aiohttp.ClientSession] = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=CONFIG.timeout_seconds)
            connector = aiohttp.TCPConnector(limit=self.concurrency * 2, ttl_dns_cache=300)
            self._session = aiohttp.ClientSession(timeout=timeout, connector=connector)
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def make_cache_key(self, messages: List[Dict[str, str]], temperature: float) -> str:
        return self.cache.make_key(CONFIG.model_name, messages, temperature)

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = CONFIG.temperature,
        max_tokens: int = CONFIG.max_tokens,
        use_cache: bool = True
    ) -> str:
        # 1. 检查缓存
        cache_key = self.make_cache_key(messages, temperature)
        if use_cache:
            cached_resp = self.cache.get(cache_key)
            if cached_resp is not None:
                print(f"      [LLM Cache] Hit ({cache_key[:8]})", flush=True)
                return cached_resp

        payload = {
            "model": CONFIG.model_name,
            "messages": messages,
            "temperature": temperature,
            "top_p": CONFIG.top_p,
            "max_tokens": max_tokens,
            "stream": CONFIG.stream
        }

        # 2. 并发限流调度与指数退避重试 (复用 TCP 会话池)
        async with self.semaphore:
            session = await self.get_session()
            last_err = None
            for attempt in range(1, CONFIG.max_retries + 1):
                t0 = time.perf_counter()
                print(f"      [LLM Client] Sending request to {CONFIG.model_name} (attempt {attempt}/{CONFIG.max_retries}, stream={CONFIG.stream})...", flush=True)
                try:
                    async with session.post(self.api_url, headers=self.headers, json=payload) as resp:
                        elapsed = time.perf_counter() - t0
                        if resp.status == 200:
                            if not CONFIG.stream:
                                res_json = await resp.json()
                                content = res_json["choices"][0]["message"]["content"]
                                print(f"      [LLM Client] Response received in {elapsed:.1f}s", flush=True)
                                if use_cache:
                                    self.cache.set(cache_key, content)
                                return content

                            # 流式输出与静默超时中断
                            first_token_time = None
                            chunks = []
                            while True:
                                # 首字等待上限与块间静默等待上限
                                chunk_timeout = CONFIG.ttft_timeout if first_token_time is None else CONFIG.idle_chunk_timeout
                                try:
                                    raw_line = await asyncio.wait_for(resp.content.readline(), timeout=chunk_timeout)
                                except asyncio.TimeoutError:
                                    if first_token_time is None:
                                        raise TimeoutError(f"TTFT timeout (no response after {chunk_timeout:.0f}s)")
                                    else:
                                        raise TimeoutError(f"Stream stall (no chunk after {chunk_timeout:.0f}s)")

                                if not raw_line:
                                    break

                                line = raw_line.decode("utf-8", errors="replace").strip()
                                if not line:
                                    continue
                                if line == "data: [DONE]":
                                    break
                                if line.startswith("data: "):
                                    try:
                                        chunk_obj = json.loads(line[6:])
                                        choices = chunk_obj.get("choices", [])
                                        if choices:
                                            delta = choices[0].get("delta", {})
                                            content_piece = delta.get("content")
                                            if content_piece:
                                                if first_token_time is None:
                                                    first_token_time = time.perf_counter() - t0
                                                chunks.append(content_piece)
                                    except Exception:
                                        pass

                            content = "".join(chunks).strip()
                            elapsed = time.perf_counter() - t0
                            ttft_str = f" (TTFT: {first_token_time:.1f}s)" if first_token_time else ""
                            print(f"      [LLM Stream] Received {len(content)} chars in {elapsed:.1f}s{ttft_str}", flush=True)
                            if use_cache and content:
                                self.cache.set(cache_key, content)
                            return content
                        else:
                            err_text = await resp.text()
                            last_err = f"HTTP {resp.status}: {err_text[:200]}"
                            print(f"      [LLM Client Warning] Attempt {attempt} returned HTTP {resp.status} in {elapsed:.1f}s", flush=True)
                except (asyncio.TimeoutError, TimeoutError) as e:
                    elapsed = time.perf_counter() - t0
                    last_err = f"Timeout: {str(e)}"
                    print(f"      [LLM Client Warning] Attempt {attempt} timed out after {elapsed:.1f}s: {e}", flush=True)
                except Exception as e:
                    elapsed = time.perf_counter() - t0
                    last_err = f"Exception: {str(e)}"
                    print(f"      [LLM Client Warning] Attempt {attempt} failed in {elapsed:.1f}s: {e}", flush=True)

                if attempt < CONFIG.max_retries:
                    # 指数退避加随机扰动 (Jitter)
                    sleep_time = (CONFIG.retry_delay_base ** attempt) + random.uniform(0.1, 0.5)
                    print(f"      [LLM Client Warning] Retrying in {sleep_time:.1f}s...", flush=True)
                    await asyncio.sleep(sleep_time)

            raise RuntimeError(f"LLM API call failed after {CONFIG.max_retries} attempts: {last_err}")
