# -*- coding: utf-8 -*-
"""
NuanceTEM 专八题库全量归档、物理拆包与前端构建发布脚本
1. 完整留存原始数据至 archive_data/ (包括 75 个批次原始 JSON、未清洗全真主数据、旧版题库)
2. 合并 1,500 题至 public/data/questions_tem8.json
3. 执行分类拆包 (pipeline/taxonomy/migrate_and_split.mjs) 生成 4 大考点物理分包与 manifest.json
4. 执行前端生产环境强类型编译 (vue-tsc + vite build)
"""

import os
import sys
import shutil
import json
import subprocess

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCHES_DIR = os.path.join(PROJECT_ROOT, "pipeline", "tem8", "batches")
ARCHIVE_DIR = os.path.join(PROJECT_ROOT, "archive_data")
PUBLIC_DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data")
MIGRATE_SCRIPT = os.path.join(PROJECT_ROOT, "pipeline", "taxonomy", "migrate_and_split.mjs")

def run():
    print("=========================================================================")
    print("           NuanceTEM 专八 1,500 题全量数据归档与生产发布流水线           ")
    print("=========================================================================")

    # -------------------------------------------------------------
    # Step 1: 原始数据深度留存与归档
    # -------------------------------------------------------------
    print("\n[Step 1] 正在执行原始数据全量归档...")
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    raw_batches_archive_dir = os.path.join(ARCHIVE_DIR, "tem8_raw_batches_1500")
    os.makedirs(raw_batches_archive_dir, exist_ok=True)

    all_raw_questions = []
    for i in range(75):
        bf_name = f"batch_{i:02d}.json"
        src_bf = os.path.join(BATCHES_DIR, bf_name)
        dst_bf = os.path.join(raw_batches_archive_dir, bf_name)

        if not os.path.exists(src_bf):
            raise FileNotFoundError(f"Missing raw batch: {src_bf}")

        # 备份单个批次原始文件
        shutil.copy2(src_bf, dst_bf)

        with open(src_bf, "r", encoding="utf-8") as f:
            b_data = json.load(f)
            all_raw_questions.extend(b_data)

    print(f"  [OK] 已备份全部 75 个批次原始文件至: {raw_batches_archive_dir}")

    # 备份带有全部质检字段的 1500 题总主库
    raw_master_path = os.path.join(ARCHIVE_DIR, "questions_tem8_raw_master_1500.json")
    with open(raw_master_path, "w", encoding="utf-8") as f:
        json.dump(all_raw_questions, f, ensure_ascii=False, indent=2)
    print(f"  [OK] 已备份完整原始主库 (含 _l1_passed/_l2_passed 等全部元数据): {raw_master_path} ({len(all_raw_questions)} 题)")

    # 备份旧版 60 题 public 数据
    legacy_pub_path = os.path.join(PUBLIC_DATA_DIR, "questions_tem8.json")
    if os.path.exists(legacy_pub_path):
        legacy_archive_path = os.path.join(ARCHIVE_DIR, "questions_tem8_legacy_before_1500.json")
        shutil.copy2(legacy_pub_path, legacy_archive_path)
        print(f"  [OK] 已备份原 public/data/questions_tem8.json 至: {legacy_archive_path}")

    # -------------------------------------------------------------
    # Step 2: 生产环境轻量化合并 (剔除管线私有调试标记)
    # -------------------------------------------------------------
    print("\n[Step 2] 正在生成生产环境标准题库 questions_tem8.json...")
    clean_questions = []
    for q in all_raw_questions:
        clean_q = {k: v for k, v in q.items() if not k.startswith("_")}
        clean_questions.append(clean_q)

    with open(legacy_pub_path, "w", encoding="utf-8") as f:
        json.dump(clean_questions, f, ensure_ascii=False, indent=2)

    print(f"  [OK] 成功写入生产级题库至: {legacy_pub_path} (共 {len(clean_questions)} 题)")

    # -------------------------------------------------------------
    # Step 3: 执行四维考点物理分包与 Manifest 生成
    # -------------------------------------------------------------
    print("\n[Step 3] 正在调用分类拆包器执行考点物理拆包...")
    node_cmd = ["node", MIGRATE_SCRIPT]
    res = subprocess.run(node_cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
    print(res.stdout.encode('gbk', errors='replace').decode('gbk'))
    if res.returncode != 0:
        print("[Error] 拆包执行失败:", res.stderr.encode('gbk', errors='replace').decode('gbk'))
        sys.exit(1)

    print("  [OK] 考点物理分包成功生成!")

    # -------------------------------------------------------------
    # Step 4: 执行前端生产环境强类型编译
    # -------------------------------------------------------------
    print("\n[Step 4] 正在执行前端构建与类型校验 (pnpm build)...")
    pnpm_cmd = r"C:\Users\mumu\AppData\Roaming\npm\pnpm.cmd"
    if not os.path.exists(pnpm_cmd):
        pnpm_cmd = "pnpm"

    build_res = subprocess.run([pnpm_cmd, "build"], cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8")
    print(build_res.stdout.encode('gbk', errors='replace').decode('gbk'))
    if build_res.returncode != 0:
        print("[Error] 前端构建失败:", build_res.stderr.encode('gbk', errors='replace').decode('gbk'))
        sys.exit(1)

    print("  [OK] 前端生产环境构建 100% 成功!")

    print("\n=========================================================================")
    print(" >>> 恭喜！全量 1,500 题归档留存、物理分包、清单更新与前端构建全部圆满完成！<<< ")
    print("=========================================================================")

if __name__ == "__main__":
    run()
