import os
import re
import json
import urllib.request

# 本地语料库持久化脚本：将专四专八官方大纲词表永久固化到本地，杜绝每次网络请求
def setup_local_corpus():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    corpus_dir = os.path.join(script_dir, "corpus")
    os.makedirs(corpus_dir, exist_ok=True)

    txt_path = os.path.join(corpus_dir, "tem_syllabus_official.txt")
    json_path = os.path.join(corpus_dir, "syllabus_cache.json")

    # 1. 如果本地没有 txt 文件，下载一次并永久保存
    if not os.path.exists(txt_path):
        url = "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E8%8B%B1%E8%AF%AD%E4%B8%93%E4%B8%9A%E5%9B%9B%E5%85%AB%E7%BA%A7%E8%AF%8D%E6%B1%87%E8%A1%A8.txt"
        print(f"Downloading official syllabus from {url} to {txt_path} (one-time only)...")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            with open(txt_path, "wb") as f:
                f.write(content)
        print("Downloaded and saved permanently to disk!")
    else:
        print(f"Local syllabus txt already exists at {txt_path}.")

    # 2. 解析本地文件并生成结构化 JSON
    tem8_dict = {}
    tem4_dict = {}

    with open(txt_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            is_tem8 = line.startswith("*")
            clean_line = line.lstrip("*").strip()
            match = re.match(r"^([a-zA-Z\-]+)\s+(?:\[[^\]]*\])?\s*([a-z\.]+)?\s*(.*)$", clean_line)
            if match:
                word = match.group(1).lower().strip()
                pos = (match.group(2) or "").strip()
                trans = (match.group(3) or "").strip()
                if word.isalpha() and len(word) >= 2:
                    entry = {
                        "word": word,
                        "pos": pos,
                        "translation": trans,
                        "level": "TEM-8" if is_tem8 else "TEM-4"
                    }
                    if is_tem8:
                        tem8_dict[word] = entry
                    else:
                        tem4_dict[word] = entry

    combined = {
        "metadata": {
            "source": "高等学校英语专业全程通用词表 (官方大纲)",
            "tem8_count": len(tem8_dict),
            "tem4_count": len(tem4_dict),
            "total_count": len(tem8_dict) + len(tem4_dict)
        },
        "tem8_words": tem8_dict,
        "tem4_words": tem4_dict
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)

    print(f"Local corpus successfully setup and saved to {json_path}!")
    print(f"Total TEM-8 Star Words: {len(tem8_dict)}")
    print(f"Total TEM-4 Words: {len(tem4_dict)}")
    print(f"Total Words in Syllabus: {len(tem8_dict) + len(tem4_dict)}")

if __name__ == "__main__":
    setup_local_corpus()
