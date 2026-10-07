import json
import os
import sys
import subprocess
from verify_tem8_batch import verify_question

# 合并 10 个 Batch 至 questions_tem8.json，并执行物理分包

def merge_batches():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    batches_dir = os.path.join(script_dir, "batches")
    data_dir = os.path.abspath("public/data")
    target_path = os.path.join(data_dir, "questions_tem8.json")

    all_questions = []
    seen_keys = set()
    total_errors = []

    for i in range(10):
        batch_file = os.path.join(batches_dir, f"batch_{i}.json")
        if not os.path.exists(batch_file):
            print(f"Warning: batch_{i}.json does not exist yet at {batch_file}")
            continue

        try:
            with open(batch_file, "r", encoding="utf-8") as f:
                batch_data = json.load(f)
        except Exception as e:
            print(f"Error parsing {batch_file}: {e}")
            total_errors.append(f"JSON syntax error in {batch_file}: {e}")
            continue

        print(f"Loaded batch_{i}.json ({len(batch_data)} items)")
        for idx, q in enumerate(batch_data):
            # 校验题目
            errs = verify_question(q, idx)
            if errs:
                total_errors.extend(errs)

            # 唯一性检查
            dedup_key = (q.get("target_word", "").lower(), q.get("question", "")[:30])
            if dedup_key in seen_keys:
                print(f"Warning: Duplicate question detected for word '{q.get('target_word')}'")
                continue
            seen_keys.add(dedup_key)
            all_questions.append(q)

    if total_errors:
        print(f"Merge Aborted: Found {len(total_errors)} validation errors across batches:")
        for err in total_errors[:10]:
            print("  *", err)
        return False

    print(f"Total valid TEM-8 questions collected: {len(all_questions)}")

    # 重新规范化 ID 编号: tem8_001 ~ tem8_NNN
    for idx, q in enumerate(all_questions):
        q["id"] = f"tem8_{(idx + 1):03d}"

    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"Successfully saved {len(all_questions)} questions to {target_path}!")

    # 执行物理拆包
    migrate_script = os.path.abspath("pipeline/taxonomy/migrate_and_split.mjs")
    print(f"Running taxonomy migration: node {migrate_script}...")
    res = subprocess.run(["node", migrate_script], capture_output=True, text=True)
    print(res.stdout)
    if res.returncode != 0:
        print("Error during taxonomy split:", res.stderr)
        return False

    print("TEM-8 All Batches Successfully Merged & Split!")
    return True

if __name__ == "__main__":
    merge_batches()
