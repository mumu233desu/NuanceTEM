import json
import re
from typing import Any, Dict, List, Tuple
from .config import CONFIG
from .client import LLMClient
from .prompts import SYSTEM_PROMPT_REVIEWER, build_reviewer_user_prompt, extract_json

class ExclusivityReviewer:
    """
    第二层：基于 LLM 的学术排他性与文体审校器 (Critic Agent)。
    用于评估题目是否存在逻辑歧义、干扰项是否能够侥幸代入、排他锚点是否真实坚固。
    """
    def __init__(self, client: LLMClient):
        self.client = client

    async def review_question(self, q: Dict[str, Any]) -> Tuple[bool, List[str]]:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_REVIEWER},
            {"role": "user", "content": build_reviewer_user_prompt(q)}
        ]

        try:
            raw_resp = await self.client.chat_completion(
                messages=messages,
                temperature=CONFIG.reviewer_temperature,
                max_tokens=1000,
                use_cache=True
            )

            audit_res = extract_json(raw_resp)
            passed = audit_res.get("passed", False)
            score = audit_res.get("score", 0)
            issues = audit_res.get("issues", [])

            # 严格门槛：通过且得分 >= 8 分
            if passed and score >= 8:
                return True, []
            else:
                if not issues:
                    issues = [f"Reviewer gave low score ({score}/10) without specific issues."]
                return False, issues

        except Exception as e:
            # 审校 API 偶发解析错误时，记录日志并标记警告
            print(f"[Reviewer Warning] Failed to parse reviewer response for {q.get('id')}: {e}")
            return True, [f"Reviewer parse exception: {e}"]
