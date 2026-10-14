import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from typing import List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)

# 确保包路径可导入
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from llm.config import CONFIG
from llm.cache import ResponseCache
from llm.generator import BatchGenerator
from llm.verifier import RuleVerifier

def cmd_status(args):
    """查看 75 批次状态大盘看板"""
    state_file = CONFIG.batches_state_file
    if not os.path.exists(state_file):
        print(f"State file not found at: {state_file}")
        print("Please run rank_and_select_clusters_750.py first.")
        return

    with open(state_file, "r", encoding="utf-8") as f:
        states = json.load(f)

    total_batches = len(states)
    verified_batches = sum(1 for s in states.values() if s.get("status") == "VERIFIED")
    partial_batches = sum(1 for s in states.values() if s.get("status") == "PARTIAL")
    failed_batches = sum(1 for s in states.values() if s.get("status") == "FAILED")
    pending_batches = sum(1 for s in states.values() if s.get("status") == "PENDING")

    total_target_q = sum(s.get("question_target", 20) for s in states.values())
    total_verified_q = sum(s.get("questions_verified", 0) for s in states.values())

    cache = ResponseCache()

    print("\n=========================================================================")
    print("           NuanceTEM 专八题库 LLM 生成与双层审核管理看板")
    print("=========================================================================")
    print(f" [*] 批次总数: {total_batches} 批 (每批 10 组 / 20 题)")
    print(f" [*] 题目总指标: {total_target_q} 题 | 当前已验证: {total_verified_q} 题 ({total_verified_q/total_target_q:.1%})")
    print(f" [*] 批次状态分布: [已通过: {verified_batches}] [部分通过: {partial_batches}] [失败: {failed_batches}] [未开始: {pending_batches}]")
    print(f" [*] 本地响应缓存: {cache.count()} 条记录 (SHA-256 存储在 {CONFIG.llm_cache_file})")
    print("-------------------------------------------------------------------------")
    print(f"{'批次 ID':<10} | {'状态':<10} | {'目标题目':<8} | {'合格题目':<8} | {'最近更新':<20}")
    print("-------------------------------------------------------------------------")

    for k in sorted(states.keys()):
        s = states[k]
        b_id = f"Batch {s.get('batch_id', 0):02d}"
        st = s.get("status", "PENDING")
        tgt = s.get("question_target", 20)
        ver = s.get("questions_verified", 0)
        upd = s.get("last_updated") or "未执行"
        if len(upd) > 19:
            upd = upd[:19].replace("T", " ")
        print(f"{b_id:<10} | {st:<10} | {tgt:<8} | {ver:<8} | {upd:<20}")
    print("=========================================================================\n")

def parse_batch_range(spec: str) -> List[int]:
    """解析批次范围参数，如 '0', '0..4', '0,1,5'"""
    result = []
    for part in spec.split(","):
        part = part.strip()
        if ".." in part:
            start, end = part.split("..", 1)
            result.extend(range(int(start), int(end) + 1))
        elif "-" in part:
            start, end = part.split("-", 1)
            result.extend(range(int(start), int(end) + 1))
        elif part.isdigit():
            result.append(int(part))
    return sorted(list(set(result)))

def cmd_run(args):
    """运行指定批次"""
    batches = parse_batch_range(args.batches)
    print(f"[CLI] Running batches: {batches} with concurrency={args.concurrency}")
    generator = BatchGenerator(concurrency=args.concurrency)

    async def _runner():
        for b in batches:
            await generator.run_batch(b, enable_l2_review=not args.no_l2)

    asyncio.run(_runner())

def cmd_run_all(args):
    """自动断点连续运行所有未完成批次"""
    state_file = CONFIG.batches_state_file
    with open(state_file, "r", encoding="utf-8") as f:
        states = json.load(f)

    pending_ids = [
        s["batch_id"] for s in states.values()
        if s.get("status") != "VERIFIED"
    ]
    print(f"[CLI] Found {len(pending_ids)} unverified batches to run: {pending_ids}")
    generator = BatchGenerator(concurrency=args.concurrency)

    async def _runner():
        for b in pending_ids:
            await generator.run_batch(b, enable_l2_review=not args.no_l2)

    asyncio.run(_runner())

def cmd_review(args):
    """重新执行本地规则与审查 (支持 --l2 参数开启 Layer 2 审校)"""
    b_id = args.batch
    batch_file = os.path.join(CONFIG.batches_dir, f"batch_{b_id:02d}.json")
    if not os.path.exists(batch_file):
        print(f"Batch file not found: {batch_file}")
        return

    with open(batch_file, "r", encoding="utf-8") as f:
        questions = json.load(f)

    verifier = RuleVerifier()
    chunk_file = os.path.join(CONFIG.chunks_dir, f"chunk_{b_id:02d}.json")
    cluster_map = {}
    if os.path.exists(chunk_file):
        with open(chunk_file, "r", encoding="utf-8") as f:
            cdata = json.load(f)
            for cl in cdata.get("clusters", []):
                cluster_map[cl["group_id"]] = cl

    run_l2 = getattr(args, "l2", False)
    reviewer = None
    if run_l2:
        from llm.client import LLMClient
        from llm.reviewer import ExclusivityReviewer
        client = LLMClient()
        reviewer = ExclusivityReviewer(client)

    passed = 0
    print(f"\n[Reviewing Batch {b_id:02d}] Total {len(questions)} questions (L2 enabled: {run_l2}):")

    async def _async_review():
        nonlocal passed
        for q in questions:
            cl = cluster_map.get(q.get("group_id"))
            ok, errs = verifier.verify_question(q, cluster=cl, expected_id=q.get("id"))
            if not ok:
                print(f"  ✗ [{q['id']}] {q['target_word']} -> L1 FAIL: {errs}")
                continue

            if reviewer:
                l2_ok, l2_errs = await reviewer.review_question(q)
                if not l2_ok:
                    print(f"  ✗ [{q['id']}] {q['target_word']} -> L2 FAIL: {l2_errs}")
                    continue

            passed += 1
            print(f"  ✓ [{q['id']}] {q['target_word']} -> PASS (L1 + {'L2' if reviewer else 'Rules'})")

    if run_l2:
        asyncio.run(_async_review())
    else:
        for q in questions:
            cl = cluster_map.get(q.get("group_id"))
            ok, errs = verifier.verify_question(q, cluster=cl, expected_id=q.get("id"))
            if ok:
                passed += 1
                print(f"  ✓ [{q['id']}] {q['target_word']} -> PASS")
            else:
                print(f"  ✗ [{q['id']}] {q['target_word']} -> FAIL: {errs}")

    print(f"\nResult: {passed}/{len(questions)} passed verification.")

def cmd_merge(args):
    """全量聚合已验证批次并物理分包拆分（支持幂等合并与规范数据契约）"""
    print("\n[Merge] Scanning verified batch files in:", CONFIG.batches_dir)
    all_questions = []
    seen_ids = set()

    state_file = CONFIG.batches_state_file
    verified_batch_names = []
    if os.path.exists(state_file):
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
            verified_batch_names = [k for k, v in state.items() if v.get("status") == "VERIFIED"]

    if not verified_batch_names:
        print("[Merge] No VERIFIED batches found in state file!")
        return

    print(f"[Merge] Found {len(verified_batch_names)} VERIFIED batches in state: {', '.join(sorted(verified_batch_names))}")

    for bname in sorted(verified_batch_names):
        fp = os.path.join(CONFIG.batches_dir, f"{bname}.json")
        if os.path.exists(fp):
            with open(fp, "r", encoding="utf-8") as f:
                items = json.load(f)
                for q in items:
                    if q["id"] not in seen_ids:
                        seen_ids.add(q["id"])
                        all_questions.append(q)
        else:
            print(f"[Merge] Warning: Batch file not found: {fp}")

    print(f"[Merge] Aggregated {len(all_questions)} unique questions from verified batches.")
    verifier = RuleVerifier()
    valid_questions = []
    for q in all_questions:
        ok, _ = verifier.verify_question(q)
        if ok:
            valid_questions.append(q)

    print(f"[Merge] Total 100% compliant questions: {len(valid_questions)}")

    # 路径准备
    root_dir = os.path.dirname(os.path.dirname(CONFIG.base_dir))
    public_data_dir = os.path.join(root_dir, "public", "data")
    tem8_dir = os.path.join(public_data_dir, "tem8")
    os.makedirs(tem8_dir, exist_ok=True)

    # 1. 契约规范化与分类分包 (Schema Normalization & Categorization)
    by_mech = {
        "collocation": [],
        "connotation": [],
        "register": [],
        "nuance": []
    }

    normalized_questions = []
    for q in valid_questions:
        nq = dict(q)
        mech_raw = str(nq.get("primary_mechanism") or nq.get("mechanism") or "MECH_NUANCE").upper()

        # 归一化映射到前端四大核心机制
        if "COLLOCATION" in mech_raw or "SYNTAX" in mech_raw:
            canonical_mech = "MECH_COLLOCATION"
            cat = "collocation"
        elif "CONNOTATION" in mech_raw:
            canonical_mech = "MECH_CONNOTATION"
            cat = "connotation"
        elif "REGISTER" in mech_raw:
            canonical_mech = "MECH_REGISTER"
            cat = "register"
        else:
            canonical_mech = "MECH_NUANCE"
            cat = "nuance"

        nq["mechanism"] = canonical_mech
        nq["primary_mechanism"] = canonical_mech
        if "taxonomy_notes" not in nq:
            nq["taxonomy_notes"] = nq.get("anchor_clue", "")

        normalized_questions.append(nq)
        by_mech[cat].append(nq)

    # 2. 保存分包文件至 public/data/tem8/
    for k, v in by_mech.items():
        sub_path = os.path.join(tem8_dir, f"{k}.json")
        with open(sub_path, "w", encoding="utf-8") as f:
            json.dump(v, f, ensure_ascii=False, indent=2)
        print(f"  -> [tem8/{k}] {len(v)} questions saved to {sub_path}")

    # 3. 保存全量 questions_tem8.json (兼顾 tem8 目录与根目录兼容)
    full_path_tem8 = os.path.join(tem8_dir, "questions_tem8.json")
    with open(full_path_tem8, "w", encoding="utf-8") as f:
        json.dump(normalized_questions, f, ensure_ascii=False, indent=2)
    print(f"  -> Saved full dataset to {full_path_tem8}")

    full_path_root = os.path.join(public_data_dir, "questions_tem8.json")
    with open(full_path_root, "w", encoding="utf-8") as f:
        json.dump(normalized_questions, f, ensure_ascii=False, indent=2)

    # 4. 幂等更新 manifest.json (完整保留 tem4 配置)
    manifest_path = os.path.join(public_data_dir, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception as e:
            print(f"[Merge] Warning: Could not read existing manifest.json: {e}")

    now_dt = datetime.now()
    now_stamp = now_dt.strftime("%Y.%m.%d")
    version_str = f"{now_stamp}.preview" if len(normalized_questions) < 1500 else now_stamp

    manifest["version"] = version_str
    manifest["updated_at"] = int(now_dt.timestamp() * 1000)

    if "packages" not in manifest or not isinstance(manifest["packages"], dict):
        manifest["packages"] = {}

    # 保留 tem4 不变（如果缺失则提供标准占位）
    if "tem4" not in manifest["packages"]:
        manifest["packages"]["tem4"] = {
            "collocation": {"path": "tem4/collocation.json", "count": 0, "label": "介词与句式搭配"},
            "connotation": {"path": "tem4/connotation.json", "count": 0, "label": "感情色彩与褒贬"},
            "register": {"path": "tem4/register.json", "count": 0, "label": "语境庄谐与文体"},
            "nuance": {"path": "tem4/nuance.json", "count": 0, "label": "词义侧重与深浅"},
            "total_count": 0
        }

    # 更新 tem8 结构
    manifest["packages"]["tem8"] = {
        "collocation": {
            "path": "tem8/collocation.json",
            "count": len(by_mech["collocation"]),
            "label": "介词与句式搭配"
        },
        "connotation": {
            "path": "tem8/connotation.json",
            "count": len(by_mech["connotation"]),
            "label": "感情色彩与褒贬"
        },
        "register": {
            "path": "tem8/register.json",
            "count": len(by_mech["register"]),
            "label": "语境庄谐与文体"
        },
        "nuance": {
            "path": "tem8/nuance.json",
            "count": len(by_mech["nuance"]),
            "label": "词义侧重与深浅"
        },
        "total_count": len(normalized_questions)
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"  -> Updated manifest.json cleanly: version '{version_str}', tem8 total {len(normalized_questions)}, tem4 preserved.")


def main():
    parser = argparse.ArgumentParser(description="NuanceTEM TEM-8 LLM Pipeline Management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # status
    p_status = subparsers.add_parser("status", help="Show batch status dashboard")
    p_status.set_defaults(func=cmd_status)

    # run
    p_run = subparsers.add_parser("run", help="Run specific batches (e.g. --batches 0..4)")
    p_run.add_argument("--batches", required=True, help="Batch range, e.g. '0', '0..4', '0,1,5'")
    p_run.add_argument("--concurrency", type=int, default=CONFIG.default_concurrency, help="Concurrency limit")
    p_run.add_argument("--no-l2", action="store_true", help="Disable Layer 2 LLM review (rule-only)")
    p_run.set_defaults(func=cmd_run)

    # run-all
    p_run_all = subparsers.add_parser("run-all", help="Run all unverified batches continuously")
    p_run_all.add_argument("--concurrency", type=int, default=CONFIG.default_concurrency, help="Concurrency limit")
    p_run_all.add_argument("--no-l2", action="store_true", help="Disable Layer 2 LLM review (rule-only)")
    p_run_all.set_defaults(func=cmd_run_all)

    # review
    p_review = subparsers.add_parser("review", help="Re-review a generated batch")
    p_review.add_argument("--batch", type=int, required=True, help="Batch ID (0-74)")
    p_review.add_argument("--l2", action="store_true", help="Also run Layer 2 LLM review")
    p_review.set_defaults(func=cmd_review)

    # merge
    p_merge = subparsers.add_parser("merge", help="Merge verified batches and split for production")
    p_merge.set_defaults(func=cmd_merge)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
