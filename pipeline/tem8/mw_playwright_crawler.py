import json
import os
import sys
import time
from playwright.sync_api import sync_playwright

# Merriam-Webster Playwright Crawler (Scheme C - Cloudflare Bypass)
# 针对 225 组专八目标词，抓取官方定义、原生例句与最新外刊真实语料

def run_crawler(limit=None):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    clusters_path = os.path.join(script_dir, "tem8_clusters_225.json")
    cache_path = os.path.join(script_dir, "mw_cache.json")

    with open(clusters_path, "r", encoding="utf-8") as f:
        clusters = json.load(f)

    # 收集需要爬取的目标词（每个词群的 target_word）
    target_words = []
    seen = set()
    for c in clusters:
        tw = c.get("target_word", "").lower().strip()
        if tw and tw not in seen:
            target_words.append(tw)
            seen.add(tw)

    if limit:
        target_words = target_words[:limit]

    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception as e:
            print("Error loading existing cache:", e)

    print(f"Total target words: {len(target_words)}, Already cached: {len(cache)}")
    words_to_fetch = [w for w in target_words if w not in cache]
    print(f"Words remaining to fetch: {len(words_to_fetch)}")

    if not words_to_fetch:
        print("All target words are already cached!")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        # 阻断图片、样式、字体与广告，极致提升加载速度并降低流量开销
        page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,css,ico}", lambda r: r.abort())
        page.route("**/*{google,analytics,doubleclick,adservice,facebook,criteo}*", lambda r: r.abort())

        success_count = 0
        for i, word in enumerate(words_to_fetch):
            url = f"https://www.merriam-webster.com/dictionary/{word}"
            try:
                resp = page.goto(url, timeout=18000)
                if resp.status == 200:
                    # 1. 抓取英文释义
                    defs = [d.inner_text().strip().lstrip(':').strip() for d in page.query_selector_all('.dtText')[:4]]
                    # 2. 抓取词典原生例句
                    dict_examples = [e.inner_text().strip() for e in page.query_selector_all('.sub-content-thread .t')[:6]]
                    # 3. 抓取真实外刊报道用例 (Recent Examples on the Web)
                    web_examples = [e.inner_text().strip() for e in page.query_selector_all('.on-web .sub-content-thread .t')[:4]]
                    # 4. 抓取同义词辨析段落
                    syn_elem = page.query_selector('#synonyms') or page.query_selector('.syn-discussion')
                    syn_text = syn_elem.inner_text().strip()[:600] if syn_elem else ""

                    cache[word] = {
                        "word": word,
                        "definitions": defs,
                        "dictionary_examples": dict_examples,
                        "web_examples": web_examples,
                        "synonym_discussion": syn_text,
                        "updated_at": int(time.time())
                    }
                    success_count += 1
                    print(f"[{i+1}/{len(words_to_fetch)}] {word} -> OK (defs: {len(defs)}, ex: {len(dict_examples) + len(web_examples)})")
                elif resp.status == 404:
                    cache[word] = {
                        "word": word,
                        "definitions": [],
                        "dictionary_examples": [],
                        "web_examples": [],
                        "synonym_discussion": "",
                        "not_found": True
                    }
                    print(f"[{i+1}/{len(words_to_fetch)}] {word} -> 404 Not Found")
                else:
                    print(f"[{i+1}/{len(words_to_fetch)}] {word} -> Status {resp.status}")

            except Exception as e:
                print(f"[{i+1}/{len(words_to_fetch)}] {word} -> Error: {e}")

            # 定期写回磁盘
            if (i + 1) % 5 == 0 or (i + 1) == len(words_to_fetch):
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(cache, f, ensure_ascii=False, indent=2)

            time.sleep(0.5)

        browser.close()

    print(f"Crawler run finished! Total in cache: {len(cache)}")

if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run_crawler(limit)
