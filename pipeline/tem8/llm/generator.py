import asyncio
import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from .config import CONFIG
from .client import LLMClient
from .verifier import RuleVerifier
from .reviewer import ExclusivityReviewer
from .prompts import (
    SYSTEM_PROMPT_GENERATOR,
    build_generator_user_prompt,
    build_retry_user_prompt,
    extract_json
)

class BatchGenerator:
    """
    批次生成与双层靶向质检引擎。
    管理单批次内 10 组词群（20 题）的异步并发派发、逐题双层质检与闭环重试。
    """
    def __init__(self, concurrency: int = CONFIG.default_concurrency):
        self.client = LLMClient(concurrency=concurrency)
        self.verifier = RuleVerifier()
        self.reviewer = ExclusivityReviewer(self.client)
        self.mw_cache = self._load_mw_cache()

    def _load_mw_cache(self) -> Dict[str, Any]:
        if os.path.exists(CONFIG.mw_cache_file):
            try:
                with open(CONFIG.mw_cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[Generator] Warning: Could not read mw_cache: {e}")
        return {}

    async def _repair_question(
        self,
        question: Dict[str, Any],
        cluster: Dict[str, Any],
        errors: List[str],
        max_retries: int = 3
    ) -> Optional[Dict[str, Any]]:
        """靶向自动重试：向 LLM 注入错误原因进行单题修复"""
        curr_q = question
        curr_errors = errors

        for attempt in range(1, max_retries + 1):
            print(f"      [Retry #{attempt}] Repairing {curr_q.get('id')} for issues: {curr_errors[:2]}")
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_GENERATOR},
                {"role": "user", "content": build_retry_user_prompt(curr_q, curr_errors, cluster)}
            ]

            try:
                raw_resp = await self.client.chat_completion(
                    messages=messages,
                    temperature=CONFIG.temperature,
                    use_cache=False  # 修复重试绕过缓存
                )
                fixed_q = extract_json(raw_resp)
                if isinstance(fixed_q, list) and len(fixed_q) > 0:
                    fixed_q = fixed_q[0]

                # Layer 1 再次质检
                l1_ok, l1_errs = self.verifier.verify_question(fixed_q)
                if not l1_ok:
                    curr_q = fixed_q
                    curr_errors = l1_errs
                    continue

                # Layer 2 审校
                l2_ok, l2_errs = await self.reviewer.review_question(fixed_q)
                if not l2_ok:
                    curr_q = fixed_q
                    curr_errors = l2_errs
                    continue

                print(f"      [Retry Success] {fixed_q.get('id')} repaired and passed dual review!")
                return fixed_q

            except Exception as e:
                curr_errors = [f"Repair parse exception: {e}"]

        print(f"      [Retry Failed] Could not repair {curr_q.get('id')} after {max_retries} attempts.")
        return curr_q

    async def process_cluster(
        self,
        cluster: Dict[str, Any],
        batch_id: int,
        idx_in_batch: int,
        enable_l2_review: bool = True
    ) -> List[Dict[str, Any]]:
        """处理单组词群，生成并质检 2 道题目"""
        q_id_1 = f"tem8_b{batch_id:02d}_{idx_in_batch * 2 + 1:02d}"
        q_id_2 = f"tem8_b{batch_id:02d}_{idx_in_batch * 2 + 2:02d}"

        # 提取 MW 真实学术例句 (合并词典原生例句与外刊真实报道，保留 100% 完整长难句)
        target = cluster["target_word"]
        mw_entry = self.mw_cache.get(target, {})
        dict_exs = mw_entry.get("dictionary_examples", [])
        web_exs = mw_entry.get("web_examples", [])
        mw_examples = list(dict.fromkeys(dict_exs + web_exs))
        mw_defs = mw_entry.get("definitions", [])

        # 确定 target_1 与 target_2 (二者均严格保证属于专八标星大纲词)
        target_1 = cluster["target_word"]
        other_t8 = [w for w in cluster["words"] if w in self.verifier.tem8_words and w != target_1]
        target_2 = other_t8[0] if other_t8 else target_1

        user_prompt = build_generator_user_prompt(
            cluster, q_id_1, q_id_2, mw_examples, mw_defs, secondary_target=target_2
        )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_GENERATOR},
            {"role": "user", "content": user_prompt}
        ]

        raw_resp = await self.client.chat_completion(messages=messages, temperature=CONFIG.temperature)
        questions = extract_json(raw_resp)
        if not isinstance(questions, list):
            questions = [questions]

        verified_questions = []
        for q in questions[:2]:
            # Layer 1: Python 规则质检
            l1_ok, l1_errs = self.verifier.verify_question(q)
            if not l1_ok:
                repaired = await self._repair_question(q, cluster, l1_errs)
                if repaired:
                    q = repaired

            # Layer 2: LLM 审校
            if enable_l2_review:
                l2_ok, l2_errs = await self.reviewer.review_question(q)
                if not l2_ok:
                    repaired = await self._repair_question(q, cluster, l2_errs)
                    if repaired:
                        q = repaired

            verified_questions.append(q)

        return verified_questions

    async def run_batch(
        self,
        batch_id: int,
        enable_l2_review: bool = True
    ) -> Dict[str, Any]:
        """运行单批次 10 组词群的全流程"""
        chunk_file = os.path.join(CONFIG.chunks_dir, f"chunk_{batch_id:02d}.json")
        if not os.path.exists(chunk_file):
            raise FileNotFoundError(f"Chunk file not found: {chunk_file}")

        with open(chunk_file, "r", encoding="utf-8") as f:
            chunk_data = json.load(f)

        clusters = chunk_data["clusters"]
        print(f"\n=======================================================")
        print(f" [Batch {batch_id:02d}] Starting generation for {len(clusters)} clusters ({len(clusters)*2} questions)")
        print(f"=======================================================")

        # 异步并发生成本批次内的所有词群
        tasks = [
            self.process_cluster(cl, batch_id, idx, enable_l2_review=enable_l2_review)
            for idx, cl in enumerate(clusters)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        batch_questions = []
        errors = []
        for r in results:
            if isinstance(r, list):
                batch_questions.extend(r)
            elif isinstance(r, Exception):
                errors.append(str(r))

        # 统计合格率
        pass_count = 0
        for q in batch_questions:
            l1_ok, _ = self.verifier.verify_question(q)
            if l1_ok:
                pass_count += 1

        # 保存本批次产物
        os.makedirs(CONFIG.batches_dir, exist_ok=True)
        out_batch_file = os.path.join(CONFIG.batches_dir, f"batch_{batch_id:02d}.json")
        with open(out_batch_file, "w", encoding="utf-8") as f:
            json.dump(batch_questions, f, ensure_ascii=False, indent=2)

        # 更新批次状态
        state = self._update_batch_state(
            batch_id=batch_id,
            verified_count=pass_count,
            target_count=len(clusters) * 2,
            errors=errors
        )

        print(f"[Batch {batch_id:02d}] Done! Generated {len(batch_questions)} questions ({pass_count} passed rule verification).")
        print(f"Saved to: {out_batch_file}")
        return state

    def _update_batch_state(
        self,
        batch_id: int,
        verified_count: int,
        target_count: int,
        errors: List[str]
    ) -> Dict[str, Any]:
        state_file = CONFIG.batches_state_file
        state_data = {}
        if os.path.exists(state_file):
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    state_data = json.load(f)
            except Exception:
                pass

        key = f"batch_{batch_id:02d}"
        status = "VERIFIED" if verified_count >= target_count else ("PARTIAL" if verified_count > 0 else "FAILED")
        entry = {
            "batch_id": batch_id,
            "status": status,
            "cluster_count": target_count // 2,
            "question_target": target_count,
            "questions_verified": verified_count,
            "last_updated": datetime.now().isoformat(),
            "error_log": errors
        }
        state_data[key] = entry

        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state_data, f, ensure_ascii=False, indent=2)

        return entry
