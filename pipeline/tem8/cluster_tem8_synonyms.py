import io
import json
import os
import re
import sys
import urllib.request
from nltk.corpus import wordnet as wn

def get_wordnet_pos(pos_str):
    pos_str = pos_str.lower()
    if pos_str.startswith('v'):
        return wn.VERB
    elif pos_str.startswith('a') or pos_str.startswith('adj'):
        return wn.ADJ
    elif pos_str.startswith('n'):
        return wn.NOUN
    elif pos_str.startswith('r') or pos_str.startswith('adv'):
        return wn.ADV
    return None

def main():
    print("Step 1: Downloading official TEM-8 syllabus words...")
    url = "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E8%8B%B1%E8%AF%AD%E4%B8%93%E4%B8%9A%E5%9B%9B%E5%85%AB%E7%BA%A7%E8%AF%8D%E6%B1%87%E8%A1%A8.txt"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    
    tem8_dict = {}
    with urllib.request.urlopen(req, timeout=20) as resp:
        text = resp.read().decode('utf-8', errors='ignore')
        for line in text.split('\n'):
            line = line.strip()
            if not line:
                continue
            is_tem8 = line.startswith('*')
            clean_line = line.lstrip('*').strip()
            # Match word and pos/meaning: e.g. "abase [əˈbeɪs] v. 贬抑，使谦卑"
            match = re.match(r"^([a-zA-Z\-]+)\s+(?:\[[^\]]*\])?\s*([a-z\.]+)?\s*(.*)$", clean_line)
            if match:
                w = match.group(1).lower()
                pos = match.group(2) or ""
                trans = match.group(3) or ""
                if is_tem8 and len(w) >= 3 and w.isalpha():
                    tem8_dict[w] = {
                        "word": w,
                        "pos": pos,
                        "translation": trans
                    }
                    
    print(f"Loaded {len(tem8_dict)} official TEM-8 words.")
    
    # Famous curated high-impact TEM-8 synonym groups (anchored by Merriam-Webster & WordNet)
    curated_groups = [
        {
            "group_name": "alleviate, mitigate, palliate, soothe",
            "words": ["palliate", "mitigate", "alleviate", "soothe"],
            "pos": "v",
            "field": "FIELD_CHANGE",
            "primary_mechanism": "MECH_CONNOTATION",
            "secondary_mechanism": "MECH_NUANCE",
            "theme_label": "缓和、减免与治标姑息"
        },
        {
            "group_name": "ephemeral, transient, fleeting, evanescent",
            "words": ["evanescent", "ephemeral", "transient", "fleeting"],
            "pos": "adj",
            "field": "FIELD_NATURE",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_REGISTER",
            "theme_label": "稍纵即逝、虚无消散与短暂"
        },
        {
            "group_name": "disparage, denigrate, belittle, deprecate",
            "words": ["denigrate", "deprecate", "disparage", "belittle"],
            "pos": "v",
            "field": "FIELD_STANCE",
            "primary_mechanism": "MECH_REGISTER",
            "secondary_mechanism": "MECH_CONNOTATION",
            "theme_label": "贬抑、恶意抹黑与谦逊自贬"
        },
        {
            "group_name": "vindicate, exonerate, acquit, absolve",
            "words": ["acquit", "vindicate", "exonerate", "absolve"],
            "pos": "v",
            "field": "FIELD_RELATION",
            "primary_mechanism": "MECH_COLLOCATION",
            "secondary_mechanism": "MECH_NUANCE",
            "theme_label": "宣告无罪、洗刷冤屈与事实证实"
        },
        {
            "group_name": "equivocal, ambiguous, obscure, enigmatic",
            "words": ["equivocal", "enigmatic", "ambiguous", "obscure"],
            "pos": "adj",
            "field": "FIELD_COGNITION",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_CONNOTATION",
            "theme_label": "故弄玄虚、模棱两可与神秘莫测"
        },
        {
            "group_name": "assiduous, sedulous, diligent, industrious",
            "words": ["assiduous", "sedulous", "diligent", "industrious"],
            "pos": "adj",
            "field": "FIELD_BEHAVIOR",
            "primary_mechanism": "MECH_REGISTER",
            "secondary_mechanism": "MECH_NUANCE",
            "theme_label": "一丝不苟、刻苦钻研与勤奋"
        },
        {
            "group_name": "supercilious, disdainful, haughty, arrogant",
            "words": ["supercilious", "haughty", "disdainful", "arrogant"],
            "pos": "adj",
            "field": "FIELD_STANCE",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_REGISTER",
            "theme_label": "目空一切、傲慢挑眉与居高临下"
        },
        {
            "group_name": "ubiquitous, pervasive, omnipresent, widespread",
            "words": ["pervasive", "ubiquitous", "omnipresent", "widespread"],
            "pos": "adj",
            "field": "FIELD_NATURE",
            "primary_mechanism": "MECH_CONNOTATION",
            "secondary_mechanism": "MECH_NUANCE",
            "theme_label": "无孔不入的弥漫、随处可见与普遍"
        },
        {
            "group_name": "placate, appease, mollify, propitiate",
            "words": ["propitiate", "appease", "placate", "mollify"],
            "pos": "v",
            "field": "FIELD_RELATION",
            "primary_mechanism": "MECH_REGISTER",
            "secondary_mechanism": "MECH_CONNOTATION",
            "theme_label": "祭祀安抚、政治绥靖与平息怒火"
        },
        {
            "group_name": "reticent, taciturn, reserved, laconic",
            "words": ["laconic", "taciturn", "reticent", "reserved"],
            "pos": "adj",
            "field": "FIELD_BEHAVIOR",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_COLLOCATION",
            "theme_label": "惜字如金的凝练、沉默寡言与性格克制"
        },
        {
            "group_name": "ingenious, ingenuous, naive, subtle",
            "words": ["ingenious", "ingenuous", "naive", "subtle"],
            "pos": "adj",
            "field": "FIELD_COGNITION",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_REGISTER",
            "theme_label": "形似易混：机巧灵敏 vs 单纯天真"
        },
        {
            "group_name": "perfunctory, peremptory, cursory, imperative",
            "words": ["perfunctory", "peremptory", "cursory", "imperative"],
            "pos": "adj",
            "field": "FIELD_BEHAVIOR",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_COLLOCATION",
            "theme_label": "形似易混：敷衍草率 vs 专横独断"
        },
        {
            "group_name": "quash, quell, suppress, stifle",
            "words": ["quash", "quell", "suppress", "stifle"],
            "pos": "v",
            "field": "FIELD_RELATION",
            "primary_mechanism": "MECH_COLLOCATION",
            "secondary_mechanism": "MECH_REGISTER",
            "theme_label": "司法撤销/镇压叛乱 vs 扼杀平息"
        },
        {
            "group_name": "sensuous, sensual, aesthetic, voluptuous",
            "words": ["sensuous", "sensual", "aesthetic", "voluptuous"],
            "pos": "adj",
            "field": "FIELD_COGNITION",
            "primary_mechanism": "MECH_CONNOTATION",
            "secondary_mechanism": "MECH_REGISTER",
            "theme_label": "形似易混：感官审美 vs 肉欲享乐"
        },
        {
            "group_name": "judicious, judicial, prudent, legislative",
            "words": ["judicious", "judicial", "prudent", "legislative"],
            "pos": "adj",
            "field": "FIELD_COGNITION",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_REGISTER",
            "theme_label": "形似易混：明智审慎 vs 司法语域"
        },
        {
            "group_name": "deteriorate, degenerate, retrogress, decline",
            "words": ["deteriorate", "degenerate", "retrogress", "decline"],
            "pos": "v",
            "field": "FIELD_CHANGE",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_CONNOTATION",
            "theme_label": "恶化、堕落变质与倒退"
        },
        {
            "group_name": "capricious, mercurial, volatile, erratic",
            "words": ["capricious", "mercurial", "volatile", "erratic"],
            "pos": "adj",
            "field": "FIELD_NATURE",
            "primary_mechanism": "MECH_NUANCE",
            "secondary_mechanism": "MECH_REGISTER",
            "theme_label": "反复无常、喜怒难测与暴躁易变"
        },
        {
            "group_name": "connive, conspire, collude, scheme",
            "words": ["connive", "collude", "conspire", "scheme"],
            "pos": "v",
            "field": "FIELD_RELATION",
            "primary_mechanism": "MECH_COLLOCATION",
            "secondary_mechanism": "MECH_CONNOTATION",
            "theme_label": "纵容默许 (connive at) vs 串通勾结"
        },
        {
            "group_name": "wreak, inflict, impose, execute",
            "words": ["wreak", "inflict", "impose", "execute"],
            "pos": "v",
            "field": "FIELD_CHANGE",
            "primary_mechanism": "MECH_COLLOCATION",
            "secondary_mechanism": "MECH_CONNOTATION",
            "theme_label": "动宾连带：发泄破坏 (wreak havoc) vs 强加"
        },
        {
            "group_name": "broker, negotiate, mediate, arbitrate",
            "words": ["broker", "negotiate", "mediate", "arbitrate"],
            "pos": "v",
            "field": "FIELD_RELATION",
            "primary_mechanism": "MECH_COLLOCATION",
            "secondary_mechanism": "MECH_REGISTER",
            "theme_label": "动宾连带：斡旋停火 (broker a truce/deal) vs 仲裁"
        }
    ]
    
    # Enrich with WordNet definitions and synonyms
    print("Step 2: Enriching with WordNet 3.0 Synsets...")
    for group in curated_groups:
        group["synset_details"] = {}
        for w in group["words"]:
            synsets = wn.synsets(w, pos=get_wordnet_pos(group["pos"]))
            if not synsets:
                synsets = wn.synsets(w)
            if synsets:
                s = synsets[0]
                lemmas = [l.name().replace('_', ' ') for l in s.lemmas()]
                group["synset_details"][w] = {
                    "synset": s.name(),
                    "definition": s.definition(),
                    "synonyms_in_synset": lemmas,
                    "syllabus_trans": tem8_dict.get(w, {}).get("translation", "")
                }
            else:
                group["synset_details"][w] = {
                    "synset": "none",
                    "definition": "",
                    "synonyms_in_synset": [],
                    "syllabus_trans": tem8_dict.get(w, {}).get("translation", "")
                }
                
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "tem8_clusters.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(curated_groups, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully generated {len(curated_groups)} core TEM-8 synonym clusters to {out_path}!")

if __name__ == "__main__":
    main()
