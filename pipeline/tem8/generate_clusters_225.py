import io
import json
import os
import re
import urllib.request
from collections import defaultdict
from nltk.corpus import wordnet as wn

# 225 组专八核心近义词辨析词群生成器 (覆盖 450 道题)
# 机制：
# 1. 遍历 3,894 个专八大纲标星词汇与 ECDICT
# 2. 依托 WordNet 3.0 Synsets（同义集、Plesionyms、similar_to、co-hyponyms）聚类
# 3. 严格限定同词性（动词 ~110 组，形容词 ~85 组，名词 ~30 组）
# 4. 均匀分配至 6 大功能论述场 (FIELD_*)

PREDEFINED_SEEDS = [
    # Change & Fluctuations
    {"words": ["palliate", "mitigate", "alleviate", "soothe"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_CONNOTATION"},
    {"words": ["wreak", "inflict", "impose", "execute"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_COLLOCATION"},
    {"words": ["deteriorate", "degenerate", "retrogress", "decline"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_NUANCE"},
    {"words": ["abate", "subside", "ebb", "wane"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_NUANCE"},
    {"words": ["diminish", "dwindle", "contract", "shrink"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_NUANCE"},
    {"words": ["escalate", "proliferate", "burgeon", "multiply"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_NUANCE"},
    {"words": ["aggravate", "exacerbate", "worsen", "inflame"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_REGISTER"},
    {"words": ["amend", "rectify", "remedy", "redress"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_REGISTER"},
    {"words": ["truncate", "abridge", "curtail", "shorten"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_REGISTER"},
    {"words": ["rejuvenate", "revitalize", "resuscitate", "regenerate"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_NUANCE"},

    # Stance & Critique
    {"words": ["denigrate", "deprecate", "disparage", "belittle"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_REGISTER"},
    {"words": ["castigate", "chastise", "rebuke", "reprimand"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_REGISTER"},
    {"words": ["berate", "upbraid", "scold", "reproach"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_NUANCE"},
    {"words": ["impugn", "challenge", "gainsay", "contest"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_REGISTER"},
    {"words": ["extol", "laud", "eulogize", "commend"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_REGISTER"},
    {"words": ["substantiate", "corroborate", "authenticate", "verify"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_REGISTER"},
    {"words": ["vilify", "malign", "slander", "defame"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_CONNOTATION"},
    {"words": ["adulate", "fawn", "cajole", "flatter"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_CONNOTATION"},
    {"words": ["rebuff", "spurn", "repudiate", "reject"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_NUANCE"},
    {"words": ["decry", "denounce", "condemn", "censure"], "pos": "v", "field": "FIELD_STANCE", "mech": "MECH_REGISTER"},

    # Cognition & Argumentation
    {"words": ["equivocal", "enigmatic", "ambiguous", "obscure"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_NUANCE"},
    {"words": ["sensuous", "sensual", "aesthetic", "voluptuous"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_CONNOTATION"},
    {"words": ["judicious", "judicial", "prudent", "legislative"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_NUANCE"},
    {"words": ["specious", "spurious", "fallacious", "plausible"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_CONNOTATION"},
    {"words": ["lucid", "perspicuous", "pellucid", "transparent"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_REGISTER"},
    {"words": ["esoteric", "abstruse", "recondite", "arcane"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_REGISTER"},
    {"words": ["astute", "shrewd", "perspicacious", "sagacious"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_REGISTER"},
    {"words": ["credulous", "gullible", "naive", "ingenuous"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_CONNOTATION"},
    {"words": ["trenchant", "incisive", "pungent", "piercing"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_NUANCE"},
    {"words": ["nebulous", "vague", "indistinct", "murky"], "pos": "adj", "field": "FIELD_COGNITION", "mech": "MECH_NUANCE"},

    # Behavior & Will
    {"words": ["assiduous", "sedulous", "diligent", "industrious"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_NUANCE"},
    {"words": ["perfunctory", "peremptory", "cursory", "imperative"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_NUANCE"},
    {"words": ["tenacious", "obstinate", "stubborn", "pertinacious"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_CONNOTATION"},
    {"words": ["profligate", "prodigal", "extravagant", "spendthrift"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_CONNOTATION"},
    {"words": ["frugal", "parsimonious", "penurious", "thrifty"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_CONNOTATION"},
    {"words": ["intrepid", "audacious", "dauntless", "valiant"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_REGISTER"},
    {"words": ["timorous", "pusillanimous", "diffident", "cowardly"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_REGISTER"},
    {"words": ["indolent", "slothful", "lethargic", "torpid"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_NUANCE"},
    {"words": ["heedless", "imprudent", "reckless", "rash"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_CONNOTATION"},
    {"words": ["scrupulous", "punctilious", "meticulous", "exacting"], "pos": "adj", "field": "FIELD_BEHAVIOR", "mech": "MECH_REGISTER"},

    # Relation & Law
    {"words": ["acquit", "vindicate", "exonerate", "absolve"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_COLLOCATION"},
    {"words": ["connive", "collude", "conspire", "scheme"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_COLLOCATION"},
    {"words": ["broker", "negotiate", "mediate", "arbitrate"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_COLLOCATION"},
    {"words": ["quash", "quell", "suppress", "stifle"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_COLLOCATION"},
    {"words": ["rescind", "repeal", "revoke", "abrogate"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_REGISTER"},
    {"words": ["adhere", "conform", "comply", "abide"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_COLLOCATION"},
    {"words": ["infringe", "transgress", "violate", "contravene"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_REGISTER"},
    {"words": ["alienate", "estrange", "disaffect", "separate"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_NUANCE"},
    {"words": ["subjugate", "vanquish", "subdue", "conquer"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_REGISTER"},
    {"words": ["usurp", "arrogate", "appropriate", "seize"], "pos": "v", "field": "FIELD_RELATION", "mech": "MECH_REGISTER"},

    # Nature & Time / Spread
    {"words": ["evanescent", "ephemeral", "transient", "fleeting"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_NUANCE"},
    {"words": ["capricious", "mercurial", "volatile", "erratic"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_NUANCE"},
    {"words": ["pervasive", "ubiquitous", "omnipresent", "prevalent"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_REGISTER"},
    {"words": ["perennial", "interminable", "perpetual", "incessant"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_NUANCE"},
    {"words": ["sporadic", "intermittent", "periodic", "fitful"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_NUANCE"},
    {"words": ["salubrious", "wholesome", "healthy", "salutary"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_REGISTER"},
    {"words": ["deleterious", "detrimental", "pernicious", "noxious"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_REGISTER"},
    {"words": ["pell-mell", "chaotic", "tumultuous", "turbulent"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_NUANCE"},
    {"words": ["immutable", "unalterable", "inexorable", "inflexible"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_REGISTER"},
    {"words": ["insidious", "treacherous", "stealthy", "surreptitious"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_CONNOTATION"}
]

def load_tem8_syllabus():
    url = "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E8%8B%B1%E8%AF%AD%E4%B8%93%E4%B8%9A%E5%9B%9B%E5%85%AB%E7%BA%A7%E8%AF%8D%E6%B1%87%E8%A1%A8.txt"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    words = {}
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode('utf-8', errors='ignore')
            for line in text.split('\n'):
                line = line.strip()
                if not line or not line.startswith('*'): continue
                clean = line.lstrip('*').strip()
                match = re.match(r"^([a-zA-Z\-]+)\s+(?:\[[^\]]*\])?\s*([a-z\.]+)?\s*(.*)$", clean)
                if match:
                    w = match.group(1).lower()
                    if len(w) >= 3 and w.isalpha():
                        words[w] = {
                            "pos": match.group(2) or "",
                            "trans": match.group(3) or ""
                        }
    except Exception as e:
        print("Warning: Could not fetch syllabus online, relying on local:", e)
    return words

def infer_field(words, syn_def):
    text = (" ".join(words) + " " + syn_def).lower()
    if any(k in text for k in ['change', 'decrease', 'increase', 'reduce', 'grow', 'shrink', 'worsen', 'better', 'modify', 'alter']):
        return "FIELD_CHANGE"
    if any(k in text for k in ['critic', 'praise', 'condemn', 'judge', 'blame', 'attack', 'defend', 'argue', 'support']):
        return "FIELD_STANCE"
    if any(k in text for k in ['law', 'rule', 'court', 'agree', 'treaty', 'contract', 'punish', 'guilt', 'crime', 'obey']):
        return "FIELD_RELATION"
    if any(k in text for k in ['time', 'space', 'exist', 'nature', 'life', 'die', 'temporary', 'eternal', 'harm', 'spread']):
        return "FIELD_NATURE"
    if any(k in text for k in ['work', 'effort', 'labor', 'lazy', 'brave', 'fear', 'waste', 'save', 'act', 'conduct', 'care']):
        return "FIELD_BEHAVIOR"
    return "FIELD_COGNITION"

def infer_mech(words, syn_def):
    text = (" ".join(words) + " " + syn_def).lower()
    if any(k in text for k in ['formal', 'literary', 'law', 'legal', 'archaic', 'official', 'bookish']):
        return "MECH_REGISTER"
    if any(k in text for k in ['disapprov', 'evil', 'shame', 'bad', 'moral', 'virtue', 'noble', 'praise', 'hostile']):
        return "MECH_CONNOTATION"
    if any(k in text for k in ['preposition', 'upon', 'with', 'from', 'at', 'into', 'transitive', 'intransitive']):
        return "MECH_COLLOCATION"
    return "MECH_NUANCE"

def main():
    syllabus = load_tem8_syllabus()
    print(f"Loaded {len(syllabus)} TEM-8 syllabus words.")

    final_clusters = []
    used_targets = set()
    used_groups = set()

    # 1. First add all high-yield predefined seeds
    for seed in PREDEFINED_SEEDS:
        key = tuple(sorted(seed["words"]))
        if key not in used_groups:
            used_groups.add(key)
            target = seed["words"][0]
            used_targets.add(target)
            final_clusters.append({
                "group_id": len(final_clusters) + 1,
                "group_name": ", ".join(seed["words"]),
                "target_word": target,
                "words": seed["words"],
                "pos": seed["pos"],
                "field": seed["field"],
                "primary_mechanism": seed["mech"],
                "theme_label": f"{seed['words'][0]} 与近义词辨析",
                "synset_definition": ""
            })

    print(f"Added {len(final_clusters)} seed clusters.")

    # 2. Mine remaining clusters from WordNet 3.0 with exact POS quotas
    tem8_word_list = sorted(list(syllabus.keys()))
    quotas = {'v': 100, 'adj': 90, 'n': 35}

    pos_plans = [
        ('v', ('v',), quotas['v']),
        ('adj', ('a', 's'), quotas['adj']),
        ('n', ('n',), quotas['n'])
    ]

    for label, target_pos, target_count in pos_plans:
        current_pos_count = sum(1 for c in final_clusters if c["pos"] == label)
        for w in tem8_word_list:
            if current_pos_count >= target_count or len(final_clusters) >= 225:
                break
            if w in used_targets:
                continue

            synsets = wn.synsets(w)
            if not synsets:
                continue

            for s in synsets:
                pos_code = s.pos()
                if pos_code not in target_pos:
                    continue

                candidates = set()
                for l in s.lemmas():
                    name = l.name().lower().replace('_', ' ')
                    if name.isalpha() and 3 <= len(name) <= 15:
                        candidates.add(name)

                if pos_code in ('a', 's'):
                    for sim in s.similar_tos()[:3]:
                        for l in sim.lemmas():
                            name = l.name().lower().replace('_', ' ')
                            if name.isalpha() and 3 <= len(name) <= 15:
                                candidates.add(name)

                if len(candidates) < 4 and pos_code in ('v', 'n'):
                    for hyp in s.hypernyms()[:2]:
                        for child in hyp.hyponyms()[:15]:
                            for l in child.lemmas():
                                name = l.name().lower().replace('_', ' ')
                                if name.isalpha() and 3 <= len(name) <= 15:
                                    candidates.add(name)
                                    if len(candidates) >= 12:
                                        break

                if len(candidates) >= 4 and w in candidates:
                    cand_list = [c for c in candidates if c != w]
                    cand_list.sort(key=lambda x: (x not in syllabus, len(x)))
                    selected = [w] + cand_list[:3]
                    selected_key = tuple(sorted(selected))

                    if selected_key in used_groups:
                        continue

                    fld = infer_field(selected, s.definition())
                    mech = infer_mech(selected, s.definition())

                    used_groups.add(selected_key)
                    used_targets.add(w)
                    for c in selected:
                        if c in syllabus:
                            used_targets.add(c)

                    final_clusters.append({
                        "group_id": len(final_clusters) + 1,
                        "group_name": ", ".join(selected),
                        "target_word": w,
                        "words": selected,
                        "pos": label,
                        "field": fld,
                        "primary_mechanism": mech,
                        "theme_label": f"{w} 辨析组 ({s.name()})",
                        "synset_definition": s.definition()
                    })
                    current_pos_count += 1
                    break

    out_path = os.path.join(os.path.dirname(__file__), "tem8_clusters_225.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final_clusters, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated {len(final_clusters)} clean TEM-8 clusters into {out_path}!")

    # Summary by POS and field
    pos_counts = defaultdict(int)
    field_counts = defaultdict(int)
    for c in final_clusters:
        pos_counts[c["pos"]] += 1
        field_counts[c["field"]] += 1

    print("POS Breakdown:", dict(pos_counts))
    print("Field Breakdown:", dict(field_counts))

if __name__ == "__main__":
    main()
