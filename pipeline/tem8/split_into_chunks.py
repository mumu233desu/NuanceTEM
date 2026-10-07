import json
import os
import sys
import math
from nltk.corpus import wordnet as wn

DOMAIN_THEMES = [
    {
        "chunk_id": 0,
        "theme": "地缘政治、宏观态势与大国博弈 (Geopolitics & Macroeconomic Trends)",
        "guidance": "题干应多采用《经济学人》政经社论语体，围绕国际摩擦、通胀治理、财政赤字、多边妥协等外刊高频议题命题。"
    },
    {
        "chunk_id": 1,
        "theme": "公共政策、全球治理与外交斡旋 (Public Policy & Global Governance)",
        "guidance": "题干应体现多边组织协议签署、难民危机、主权纠纷、环境碳税公约等联合国/G20官方公文与权威媒体语调。"
    },
    {
        "chunk_id": 2,
        "theme": "学术论证、方法论与批判性思维 (Academic Argumentation & Empiricism)",
        "guidance": "题干应多出现同行评议、假说推翻、实验对照、数据偏差、论点驳斥等学术期刊摘要级长难句。"
    },
    {
        "chunk_id": 3,
        "theme": "科学哲学、逻辑推演与理论演化 (Scientific Philosophy & Epistemology)",
        "guidance": "题干探讨科学范式转移、理论自洽性、因果推断、归纳困境等高阶论述语境。"
    },
    {
        "chunk_id": 4,
        "theme": "人文艺术、文艺批评与美学思辨 (Humanities, Aesthetic Criticism & Art)",
        "guidance": "题干体现后现代文学评论、视觉艺术鉴赏、建筑风格演进、戏剧美感等《纽约书评》/《大西洋月刊》文化专栏语风。"
    },
    {
        "chunk_id": 5,
        "theme": "认知心理、心智哲学与情感精微 (Cognitive Psychology & Emotional Nuance)",
        "guidance": "题干刻画深层心理机制、群体迷思、决策心理偏差、细微性格特质（自谦、固执、虚荣、敏锐）等人性剖析。"
    },
    {
        "chunk_id": 6,
        "theme": "司法审判、法律规约与法庭辩论 (Jurisprudence & Courtroom Adjudication)",
        "guidance": "题干围绕宪法审查、证据开示、抗辩豁免、法官公断、连带责任等高阶法律英语专有连带与庄重文体。"
    },
    {
        "chunk_id": 7,
        "theme": "商业契约、公司治理与市场监管 (Commerce, Antitrust & Corporate Governance)",
        "guidance": "题干围绕反垄断诉讼、恶意并购、董事会合谋、财务欺诈排查、劳资仲裁等高阶商业评论语境。"
    },
    {
        "chunk_id": 8,
        "theme": "生态环境、气候危机与技术伦理 (Ecology, Climate Crisis & Bioethics)",
        "guidance": "题干围绕生物多样性锐减、基因编辑伦理、人工智能算法歧视、可再生能源转型等当代前沿外刊社论。"
    },
    {
        "chunk_id": 9,
        "theme": "社会变迁、历史回溯与集体记忆 (Historical Retrospect & Social Change)",
        "guidance": "题干回顾制度瓦解与兴起、殖民历史反思、代际价值观断裂、流行文化生命周期等宏大叙事学术长难句。"
    }
]

def split_chunks():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    clusters_path = os.path.join(script_dir, "tem8_clusters_225.json")
    cache_path = os.path.join(script_dir, "mw_cache.json")
    out_dir = os.path.join(script_dir, "chunks")
    os.makedirs(out_dir, exist_ok=True)

    with open(clusters_path, "r", encoding="utf-8") as f:
        clusters = json.load(f)

    mw_cache = {}
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            mw_cache = json.load(f)

    # 为每个词群补齐 WordNet 与 MW 权威例句
    enriched_clusters = []
    for c in clusters:
        tw = c.get("target_word", "")
        mw_info = mw_cache.get(tw, {})
        
        # WordNet 详细信息
        wn_details = {}
        for w in c.get("words", []):
            syns = wn.synsets(w)
            if syns:
                wn_details[w] = {
                    "synset": syns[0].name(),
                    "definition": syns[0].definition(),
                    "examples": syns[0].examples()[:2]
                }

        item_dict = dict(c)
        item_dict["merriam_webster"] = {
            "definitions": mw_info.get("definitions", []),
            "dictionary_examples": mw_info.get("dictionary_examples", []),
            "web_examples": mw_info.get("web_examples", []),
            "synonym_discussion": mw_info.get("synonym_discussion", "")
        }
        item_dict["wordnet"] = wn_details
        enriched_clusters.append(item_dict)

    # 切分为 10 个 Chunk
    chunk_size = math.ceil(len(enriched_clusters) / 10)
    for i, meta in enumerate(DOMAIN_THEMES):
        start = i * chunk_size
        end = min((i + 1) * chunk_size, len(enriched_clusters))
        chunk_items = enriched_clusters[start:end]

        chunk_data = {
            "chunk_id": i,
            "theme_info": meta,
            "cluster_count": len(chunk_items),
            "expected_questions": len(chunk_items) * 2,
            "clusters": chunk_items
        }

        chunk_file = os.path.join(out_dir, f"chunk_{i}.json")
        with open(chunk_file, "w", encoding="utf-8") as f:
            json.dump(chunk_data, f, ensure_ascii=False, indent=2)

        print(f"Created chunk_{i}.json with {len(chunk_items)} clusters (~{len(chunk_items)*2} questions)")

if __name__ == "__main__":
    split_chunks()
