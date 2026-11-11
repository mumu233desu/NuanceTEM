import asyncio
import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from .config import CONFIG
from .client import LLMClient
from .verifier import RuleVerifier
from .reviewer import ExclusivityReviewer
from .prompts import (
    SYSTEM_PROMPT_GENERATOR,
    build_generator_user_prompt,
    build_single_generator_user_prompt,
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
        self.state_lock = asyncio.Lock()

    def _load_mw_cache(self) -> Dict[str, Any]:
        if os.path.exists(CONFIG.mw_cache_file):
            try:
                with open(CONFIG.mw_cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[Generator] Warning: Could not read mw_cache: {e}")
        return {}

    def _select_targets(self, cluster: Dict[str, Any]) -> Tuple[str, str]:
        """确定 target_1 与 target_2 (二者均严格保证属于专八标星大纲词并智能避开生僻动词)"""
        target_1 = cluster["target_word"]
        other_t8 = [w for w in cluster["words"] if w in self.verifier.tem8_words and w != target_1]

        # 智能避坑：若词性为动词 (pos == 'v')，避开现代学术英语中以名词为主或不规范的动词用法
        if cluster.get("pos") == "v":
            controversial_verbs = {"flux", "trance", "indent", "crap", "piss"}
            preferred_t8 = [w for w in other_t8 if w not in controversial_verbs]
            if preferred_t8:
                other_t8 = preferred_t8

        target_2 = other_t8[0] if other_t8 else target_1
        return target_1, target_2

    async def _repair_question(
        self,
        question: Dict[str, Any],
        cluster: Dict[str, Any],
        errors: List[str],
        enable_l2_review: bool = True,
        max_retries: int = 3
    ) -> Optional[Dict[str, Any]]:
        """靶向自动重试：向 LLM 注入错误原因进行单题修复"""
        curr_q = question
        curr_errors = errors
        exp_id = curr_q.get("id")

        for attempt in range(1, max_retries + 1):
            print(f"      [Retry #{attempt}] Repairing {exp_id} for issues: {curr_errors[:2]}", flush=True)
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_GENERATOR},
                {"role": "user", "content": build_retry_user_prompt(curr_q, curr_errors, cluster)}
            ]

            try:
                print(f"      [Retry #{attempt} | Generator] Requesting revision from LLM...", flush=True)
                raw_resp = await self.client.chat_completion(
                    messages=messages,
                    temperature=CONFIG.temperature,
                    use_cache=False  # 修复重试绕过缓存
                )
                fixed_q = extract_json(raw_resp)
                if isinstance(fixed_q, list) and len(fixed_q) > 0:
                    fixed_q = fixed_q[0]

                if not isinstance(fixed_q, dict):
                    continue

                if exp_id:
                    fixed_q["id"] = exp_id

                # Layer 1 再次质检 (传入 cluster 和 expected_id)
                l1_ok, l1_errs = self.verifier.verify_question(fixed_q, cluster=cluster, expected_id=exp_id)
                if not l1_ok:
                    curr_q = fixed_q
                    curr_errors = l1_errs
                    continue

                # Layer 2 审校
                if enable_l2_review:
                    print(f"      [Retry #{attempt} | Reviewer] Running Layer 2 Review on repaired question...", flush=True)
                    l2_ok, l2_errs = await self.reviewer.review_question(fixed_q)
                    if not l2_ok:
                        curr_q = fixed_q
                        curr_errors = l2_errs
                        continue

                print(f"      [Retry Success] {exp_id} repaired and passed dual review!", flush=True)
                return fixed_q

            except Exception as e:
                curr_errors = [f"Repair parse exception: {e}"]

        print(f"      [Retry Failed] Could not repair {exp_id} after {max_retries} attempts.", flush=True)
        return None

    async def generate_single_question(
        self,
        cluster: Dict[str, Any],
        batch_id: int,
        idx_in_batch: int,
        q_id: str,
        target_word: str,
        primary_mechanism: Optional[str] = None,
        enable_l2_review: bool = True
    ) -> Optional[Dict[str, Any]]:
        """针对单个缺失考点词进行高质量生成与双层核验"""
        print(f"   [Batch {batch_id:02d} | #{idx_in_batch+1:02d}/10] Dedicated generation for missing '{target_word}' (ID: {q_id})...", flush=True)

        mw_entry = self.mw_cache.get(target_word, {})
        dict_exs = mw_entry.get("dictionary_examples", [])
        web_exs = mw_entry.get("web_examples", [])
        mw_examples = list(dict.fromkeys(dict_exs + web_exs))
        mw_defs = mw_entry.get("definitions", [])

        user_prompt = build_single_generator_user_prompt(
            cluster, q_id, target_word, mw_examples, mw_defs, primary_mechanism=primary_mechanism
        )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_GENERATOR},
            {"role": "user", "content": user_prompt}
        ]

        try:
            raw_resp = await self.client.chat_completion(messages=messages, temperature=CONFIG.temperature, use_cache=False)
            q_cand = extract_json(raw_resp)
            q = q_cand[0] if isinstance(q_cand, list) else q_cand
            if not isinstance(q, dict):
                return None
        except Exception as e:
            print(f"   [Batch {batch_id:02d}] Failed single generation call for '{target_word}': {e}", flush=True)
            return None

        q["id"] = q_id
        q["target_word"] = target_word
        q["answer"] = target_word

        # Layer 1 质检
        l1_ok, l1_errs = self.verifier.verify_question(q, cluster=cluster, expected_id=q_id)
        if not l1_ok:
            repaired = await self._repair_question(q, cluster, l1_errs, enable_l2_review=enable_l2_review)
            if repaired is not None:
                q = repaired
            else:
                print(f"      [Drop] {q_id} failed Layer 1 rules after retries, dropped.", flush=True)
                return None

        # Layer 2 审校
        if enable_l2_review:
            l2_ok, l2_errs = await self.reviewer.review_question(q)
            if not l2_ok:
                repaired = await self._repair_question(q, cluster, l2_errs, enable_l2_review=enable_l2_review)
                if repaired is not None:
                    q = repaired
                else:
                    print(f"      [Drop] {q_id} failed Layer 2 review after retries, dropped.", flush=True)
                    return None

        q["_l1_passed"] = True
        q["_l2_passed"] = True if enable_l2_review else False
        print(f"   [Batch {batch_id:02d} | #{idx_in_batch+1:02d}/10] Dedicated question for '{target_word}' (ID: {q_id}) PASSED!", flush=True)
        return q

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

        # 提取 MW 真实学术例句
        target = cluster["target_word"]
        mw_entry = self.mw_cache.get(target, {})
        dict_exs = mw_entry.get("dictionary_examples", [])
        web_exs = mw_entry.get("web_examples", [])
        mw_examples = list(dict.fromkeys(dict_exs + web_exs))
        mw_defs = mw_entry.get("definitions", [])

        target_1, target_2 = self._select_targets(cluster)

        user_prompt = build_generator_user_prompt(
            cluster, q_id_1, q_id_2, mw_examples, mw_defs, secondary_target=target_2
        )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_GENERATOR},
            {"role": "user", "content": user_prompt}
        ]

        cache_key = self.client.make_cache_key(messages, CONFIG.temperature)
        print(f"   [Batch {batch_id:02d} | #{idx_in_batch+1:02d}/10] Generating '{target}'...", flush=True)

        raw_resp = await self.client.chat_completion(messages=messages, temperature=CONFIG.temperature)
        try:
            questions = extract_json(raw_resp)
            if not isinstance(questions, list):
                questions = [questions]
        except Exception as e:
            print(f"   [Batch {batch_id:02d} | #{idx_in_batch+1:02d}/10] JSON parse error, evicting cache: {e}", flush=True)
            self.client.cache.evict(cache_key)
            raise

        print(f"   [Batch {batch_id:02d} | #{idx_in_batch+1:02d}/10] Got {len(questions)} questions for '{target}', checking quality...", flush=True)

        target_pairs = [
            (q_id_1, target_1),
            (q_id_2, target_2)
        ]

        async def _verify_item(i: int, exp_id: str, exp_tgt: str) -> Optional[Dict[str, Any]]:
            if i < len(questions) and isinstance(questions[i], dict):
                q = dict(questions[i])
            else:
                # BUG-06 修复：若 LLM 少生成了题目，发起单题针对性补全生成
                print(f"   [Batch {batch_id:02d} | #{idx_in_batch+1:02d}/10] Missing question #{i+1}, requesting dedicated generation for '{exp_tgt}'...", flush=True)
                return await self.generate_single_question(
                    cluster, batch_id, idx_in_batch, exp_id, exp_tgt, enable_l2_review=enable_l2_review
                )

            # 强制对齐 ID 与目标词
            q["id"] = exp_id
            q["target_word"] = exp_tgt
            q["answer"] = exp_tgt

            # Layer 1: Python 规则质检
            l1_ok, l1_errs = self.verifier.verify_question(q, cluster=cluster, expected_id=exp_id)
            if not l1_ok:
                repaired = await self._repair_question(q, cluster, l1_errs, enable_l2_review=enable_l2_review)
                if repaired is not None:
                    q = repaired
                else:
                    print(f"      [Drop] {exp_id} failed Layer 1 rules after retries, dropped.", flush=True)
                    self.client.cache.evict(cache_key)
                    return None

            # Layer 2: LLM 审校
            if enable_l2_review:
                l2_ok, l2_errs = await self.reviewer.review_question(q)
                if not l2_ok:
                    repaired = await self._repair_question(q, cluster, l2_errs, enable_l2_review=enable_l2_review)
                    if repaired is not None:
                        q = repaired
                    else:
                        print(f"      [Drop] {exp_id} failed Layer 2 review after retries, dropped.", flush=True)
                        self.client.cache.evict(cache_key)
                        return None

            q["_l1_passed"] = True
            q["_l2_passed"] = True if enable_l2_review else False
            return q

        item_tasks = [
            _verify_item(i, exp_id, exp_tgt)
            for i, (exp_id, exp_tgt) in enumerate(target_pairs)
        ]
        items_res = await asyncio.gather(*item_tasks)
        verified_questions = [q for q in items_res if q is not None]

        print(f"   [Batch {batch_id:02d} | #{idx_in_batch+1:02d}/10] Completed '{target}' -> {len(verified_questions)} questions passed.", flush=True)
        return verified_questions

    async def run_batch(
        self,
        batch_id: int,
        enable_l2_review: bool = True
    ) -> Dict[str, Any]:
        """运行单批次 10 组词群的全流程 (支持增量断点续跑与缺题精准填补)"""
        chunk_file = os.path.join(CONFIG.chunks_dir, f"chunk_{batch_id:02d}.json")
        if not os.path.exists(chunk_file):
            raise FileNotFoundError(f"Chunk file not found: {chunk_file}")

        with open(chunk_file, "r", encoding="utf-8") as f:
            chunk_data = json.load(f)

        clusters = chunk_data["clusters"]
        target_count = len(clusters) * 2

        # 1. 尝试读取现有 batch 文件，筛选已完全通过双层验证的题目
        out_batch_file = os.path.join(CONFIG.batches_dir, f"batch_{batch_id:02d}.json")
        existing_verified_map: Dict[str, Dict[str, Any]] = {}
        if os.path.exists(out_batch_file):
            try:
                with open(out_batch_file, "r", encoding="utf-8") as f:
                    old_list = json.load(f)
                cl_map = {cl["group_id"]: cl for cl in clusters}
                for q in old_list:
                    cl = cl_map.get(q.get("group_id"))
                    l1_ok, _ = self.verifier.verify_question(q, cluster=cl, expected_id=q.get("id"))
                    l2_ok = q.get("_l2_passed", True) if enable_l2_review else True
                    if l1_ok and l2_ok:
                        existing_verified_map[q["id"]] = q
            except Exception as e:
                print(f"[Batch {batch_id:02d}] Notice reading existing batch: {e}", flush=True)

        if len(existing_verified_map) == target_count:
            print(f"\n=======================================================")
            print(f" [Batch {batch_id:02d}] All {target_count} questions already verified. Skipping generation!")
            print(f"=======================================================")
            sorted_questions = [existing_verified_map[f"tem8_b{batch_id:02d}_{i:02d}"] for i in range(1, target_count + 1)]
            with open(out_batch_file, "w", encoding="utf-8") as f:
                json.dump(sorted_questions, f, ensure_ascii=False, indent=2)
            return await self._update_batch_state(
                batch_id=batch_id,
                verified_count=target_count,
                target_count=target_count,
                errors=[]
            )

        print(f"\n=======================================================")
        print(f" [Batch {batch_id:02d}] Starting generation (Verified: {len(existing_verified_map)}/{target_count}, Missing: {target_count - len(existing_verified_map)})")
        print(f"=======================================================")

        # 2. 对每个 Cluster 实施精准差量调度
        batch_results_map: Dict[str, Dict[str, Any]] = dict(existing_verified_map)
        tasks = []

        for idx, cl in enumerate(clusters):
            q_id_1 = f"tem8_b{batch_id:02d}_{idx * 2 + 1:02d}"
            q_id_2 = f"tem8_b{batch_id:02d}_{idx * 2 + 2:02d}"
            has_1 = q_id_1 in existing_verified_map
            has_2 = q_id_2 in existing_verified_map

            target_1, target_2 = self._select_targets(cl)

            if has_1 and has_2:
                print(f"   [Batch {batch_id:02d} | #{idx+1:02d}/10] Cluster '{cl['target_word']}' already verified ({q_id_1}, {q_id_2}), skipping.", flush=True)
                continue
            elif has_1 and not has_2:
                # 仅缺第 2 题，精准填补
                async def _fill_q2(c=cl, i=idx, qid=q_id_2, tgt=target_2):
                    res = await self.generate_single_question(c, batch_id, i, qid, tgt, enable_l2_review=enable_l2_review)
                    return [res] if res else []
                tasks.append(_fill_q2())
            elif not has_1 and has_2:
                # 仅缺第 1 题，精准填补
                async def _fill_q1(c=cl, i=idx, qid=q_id_1, tgt=target_1):
                    res = await self.generate_single_question(c, batch_id, i, qid, tgt, enable_l2_review=enable_l2_review)
                    return [res] if res else []
                tasks.append(_fill_q1())
            else:
                # 两题皆无，整组生成
                tasks.append(self.process_cluster(cl, batch_id, idx, enable_l2_review=enable_l2_review))

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            errors = []
            for r in results:
                if isinstance(r, list):
                    for q in r:
                        if isinstance(q, dict) and "id" in q:
                            batch_results_map[q["id"]] = q
                elif isinstance(r, Exception):
                    errors.append(str(r))
        else:
            errors = []

        # 3. 统计合格题目并按 ID 严格排序
        all_sorted_questions = []
        for i in range(1, target_count + 1):
            qid = f"tem8_b{batch_id:02d}_{i:02d}"
            if qid in batch_results_map:
                all_sorted_questions.append(batch_results_map[qid])

        pass_count = 0
        for q in all_sorted_questions:
            l1_ok, _ = self.verifier.verify_question(q)
            l2_ok = q.get("_l2_passed", True) if enable_l2_review else True
            if l1_ok and l2_ok:
                pass_count += 1

        # 4. 实时持久化保存本批次产物（防止中断丢题）
        os.makedirs(CONFIG.batches_dir, exist_ok=True)
        with open(out_batch_file, "w", encoding="utf-8") as f:
            json.dump(all_sorted_questions, f, ensure_ascii=False, indent=2)

        # 5. 更新批次状态
        state = await self._update_batch_state(
            batch_id=batch_id,
            verified_count=pass_count,
            target_count=target_count,
            errors=errors
        )

        print(f"[Batch {batch_id:02d}] Done! Stored {len(all_sorted_questions)} questions ({pass_count}/{target_count} passed dual-layer verification).", flush=True)
        print(f"Saved to: {out_batch_file}", flush=True)
        return state

    async def _update_batch_state(
        self,
        batch_id: int,
        verified_count: int,
        target_count: int,
        errors: List[str]
    ) -> Dict[str, Any]:
        async with self.state_lock:
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
