import hashlib
import json
import os
import threading
from typing import Any, Dict, List, Optional
from .config import CONFIG

class ResponseCache:
    """
    基于 SHA-256 提示词哈希的本地响应缓存层。
    防止重复计费/请求，支持断电断点续生与无损重启。
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._init_cache()
        return cls._instance

    def _init_cache(self):
        self.cache_file = CONFIG.llm_cache_file
        self.cache_data: Dict[str, str] = {}
        os.makedirs(CONFIG.cache_dir, exist_ok=True)
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    self.cache_data = json.load(f)
            except Exception as e:
                print(f"[Cache] Warning: Could not read cache file ({e}), starting empty.")
                self.cache_data = {}

    @staticmethod
    def make_key(model: str, messages: List[Dict[str, str]], temperature: float) -> str:
        payload = {
            "model": model,
            "temperature": round(temperature, 2),
            "messages": messages
        }
        raw_str = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            return self.cache_data.get(key)

    def set(self, key: str, value: str):
        with self._lock:
            self.cache_data[key] = value
            # 原子写盘
            tmp_file = self.cache_file + ".tmp"
            try:
                with open(tmp_file, "w", encoding="utf-8") as f:
                    json.dump(self.cache_data, f, ensure_ascii=False)
                os.replace(tmp_file, self.cache_file)
            except Exception as e:
                print(f"[Cache] Error saving cache to disk: {e}")

    def count(self) -> int:
        with self._lock:
            return len(self.cache_data)
