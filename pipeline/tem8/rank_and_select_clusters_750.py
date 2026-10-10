import json
import os
import re
from collections import defaultdict
from nltk.corpus import wordnet as wn

# 750 组专八核心近义词辨析词群生成与切片脚本 (覆盖 1,500 道题)
# 机制：
# 1. 加载本地官方大纲白名单 syllabus_cache.json (3,834 专八 + 8,263 专四 = 12,097 词)
# 2. 依托 WordNet 3.0 Synsets (同义集、Plesionyms、similar_to、co-hyponyms)
# 3. 计算 CAS 综合命题价值分 (Purity + SynDistance + DiscourseVal + FaultLineVal)
# 4. 严格词性配额 (动词 ~330 组，形容词 ~300 组，名词 ~120 组)
# 5. 均衡分配至 6 大功能论述场 (FIELD_*) 与 4 大微殊机制 (MECH_*)
# 6. 切分为 75 个 Chunk (每批 10 组 / 20 题) 并初始化 batches_state.json

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
    {"words": ["fluctuate", "oscillate", "vacillate", "waver"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_NUANCE"},
    {"words": ["stagnate", "languish", "falter", "slump"], "pos": "v", "field": "FIELD_CHANGE", "mech": "MECH_NUANCE"},

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
    {"words": ["immutable", "unalterable", "inexorable", "inflexible"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_REGISTER"},
    {"words": ["insidious", "treacherous", "stealthy", "surreptitious"], "pos": "adj", "field": "FIELD_NATURE", "mech": "MECH_CONNOTATION"}
]

def load_syllabus_cache():
    cache_path = os.path.join(os.path.dirname(__file__), "corpus", "syllabus_cache.json")
    with open(cache_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    tem8_words = set(data["tem8_words"].keys())
    tem4_words = set(data["tem4_words"].keys())
    return tem8_words, tem4_words

def infer_field(words, syn_def):
    text = (" ".join(words) + " " + syn_def).lower()
    if any(k in text for k in ['change', 'decrease', 'increase', 'reduce', 'grow', 'shrink', 'worsen', 'better', 'modify', 'alter', 'fluctuate']):
        return "FIELD_CHANGE"
    if any(k in text for k in ['critic', 'praise', 'condemn', 'judge', 'blame', 'attack', 'defend', 'argue', 'support', 'dispute']):
        return "FIELD_STANCE"
    if any(k in text for k in ['law', 'rule', 'court', 'agree', 'treaty', 'contract', 'punish', 'guilt', 'crime', 'obey', 'rights']):
        return "FIELD_RELATION"
    if any(k in text for k in ['time', 'space', 'exist', 'nature', 'life', 'die', 'temporary', 'eternal', 'harm', 'spread', 'disease']):
        return "FIELD_NATURE"
    if any(k in text for k in ['work', 'effort', 'labor', 'lazy', 'brave', 'fear', 'waste', 'save', 'act', 'conduct', 'care', 'pride']):
        return "FIELD_BEHAVIOR"
    return "FIELD_COGNITION"

def infer_mech(words, syn_def):
    text = (" ".join(words) + " " + syn_def).lower()
    if any(k in text for k in ['formal', 'literary', 'law', 'legal', 'archaic', 'official', 'bookish', 'rhetoric']):
        return "MECH_REGISTER"
    if any(k in text for k in ['disapprov', 'evil', 'shame', 'bad', 'moral', 'virtue', 'noble', 'praise', 'hostile', 'contempt']):
        return "MECH_CONNOTATION"
    if any(k in text for k in ['preposition', 'upon', 'with', 'from', 'at', 'into', 'transitive', 'intransitive', 'collocat']):
        return "MECH_COLLOCATION"
    return "MECH_NUANCE"

def calculate_cas(words, synset, tem8_words, pos_code):
    # CAS = w1*Purity + w2*SynDistance + w3*DiscourseVal + w4*FaultLineVal
    t8_count = sum(1 for w in words if w in tem8_words)
    if t8_count == 4:
        purity_score = 30
    elif t8_count == 3:
        purity_score = 22
    elif t8_count == 2:
        purity_score = 14
    else:
        purity_score = 8

    # Synset distance: direct synset lemmas vs others
    syn_score = 25 if synset else 20

    # Discourse value: Verbs/Adjectives have higher analytical weight than concrete nouns
    if pos_code in ('v', 'a', 's'):
        discourse_score = 25
    else:
        discourse_score = 18

    # FaultLine score based on inferred mechanism
    mech = infer_mech(words, synset.definition() if synset else "")
    fault_score = 20 if mech in ('MECH_COLLOCATION', 'MECH_CONNOTATION') else 16

    return purity_score + syn_score + discourse_score + fault_score

def build_top_750_clusters():
    tem8_words, tem4_words = load_syllabus_cache()
    syllabus_all = tem8_words | tem4_words
    print(f"Loaded syllabus: {len(tem8_words)} TEM-8, {len(tem4_words)} TEM-4.")

    final_clusters = []
    used_groups = set()
    used_targets = set()

    # 1. Add predefined seeds first
    for seed in PREDEFINED_SEEDS:
        key = tuple(sorted(seed["words"]))
        # Verify 100% syllabus compliance
        if not all(w in syllabus_all for w in seed["words"]):
            continue
        if key not in used_groups:
            used_groups.add(key)
            target = seed["words"][0]
            used_targets.add(target)
            t8_c = sum(1 for w in seed["words"] if w in tem8_words)
            final_clusters.append({
                "group_id": len(final_clusters) + 1,
                "group_name": ", ".join(seed["words"]),
                "target_word": target,
                "words": seed["words"],
                "pos": seed["pos"],
                "field": seed["field"],
                "primary_mechanism": seed["mech"],
                "theme_label": f"{target} 与近义词辨析",
                "synset_definition": "",
                "t8_count": t8_c,
                "cas_score": 95
            })

    print(f"Added {len(final_clusters)} validated seed clusters.")

    # 2. Mine candidates from WordNet 3.0
    quotas = {'v': 330, 'adj': 300, 'n': 120}
    pos_targets = [
        ('v', ('v',), quotas['v']),
        ('adj', ('a', 's'), quotas['adj']),
        ('n', ('n',), quotas['n'])
    ]

    for label, target_pos, target_count in pos_targets:
        current_pos_count = sum(1 for c in final_clusters if c["pos"] == label)
        print(f"Mining POS: {label} (Target: {target_count}, Current: {current_pos_count})...")

        pos_candidates = []
        for w in sorted(list(tem8_words)):
            if w in used_targets:
                continue
            for s in wn.synsets(w):
                pos_code = s.pos()
                if pos_code not in target_pos:
                    continue

                # Filter strictly by syllabus_all
                cands = [l.name().lower().replace('_', ' ') for l in s.lemmas() if l.name().lower().replace('_', ' ') in syllabus_all]
                if pos_code in ('a', 's'):
                    for sim in s.similar_tos()[:4]:
                        for l in sim.lemmas():
                            name = l.name().lower().replace('_', ' ')
                            if name in syllabus_all and name not in cands:
                                cands.append(name)

                if len(cands) < 4 and pos_code in ('v', 'n'):
                    for hyp in s.hypernyms()[:1]:
                        for child in hyp.hyponyms()[:10]:
                            for l in child.lemmas():
                                name = l.name().lower().replace('_', ' ')
                                if name in syllabus_all and name not in cands:
                                    cands.append(name)
                                    if len(cands) >= 10:
                                        break

                unique_cands = list(dict.fromkeys(cands))
                if len(unique_cands) >= 4 and w in unique_cands:
                    other_cands = [x for x in unique_cands if x != w]
                    other_cands.sort(key=lambda x: (x not in tem8_words, len(x)))
                    selected = [w] + other_cands[:3]
                    selected_key = tuple(sorted(selected))
                    if selected_key not in used_groups:
                        score = calculate_cas(selected, s, tem8_words, pos_code)
                        t8_c = sum(1 for x in selected if x in tem8_words)
                        pos_candidates.append({
                            "target_word": w,
                            "words": selected,
                            "key": selected_key,
                            "pos": label,
                            "field": infer_field(selected, s.definition()),
                            "primary_mechanism": infer_mech(selected, s.definition()),
                            "synset_definition": s.definition(),
                            "t8_count": t8_c,
                            "cas_score": score
                        })

        # Sort candidates by CAS score descending
        pos_candidates.sort(key=lambda x: (-x["cas_score"], -x["t8_count"]))

        for cand in pos_candidates:
            if current_pos_count >= target_count or len(final_clusters) >= 750:
                break
            if cand["key"] in used_groups or cand["target_word"] in used_targets:
                continue

            used_groups.add(cand["key"])
            used_targets.add(cand["target_word"])
            final_clusters.append({
                "group_id": len(final_clusters) + 1,
                "group_name": ", ".join(cand["words"]),
                "target_word": cand["target_word"],
                "words": cand["words"],
                "pos": cand["pos"],
                "field": cand["field"],
                "primary_mechanism": cand["primary_mechanism"],
                "theme_label": f"{cand['target_word']} 与近义词辨析",
                "synset_definition": cand["synset_definition"],
                "t8_count": cand["t8_count"],
                "cas_score": cand["cas_score"]
            })
            current_pos_count += 1

    # Supplementary pass to ensure exactly 750 clusters
    if len(final_clusters) < 750:
        print(f"Topping up remaining {750 - len(final_clusters)} clusters from high-scoring verbs...")
        for w in sorted(list(tem8_words)):
            if len(final_clusters) >= 750:
                break
            if w in used_targets:
                continue
            for s in wn.synsets(w):
                if s.pos() != 'v':
                    continue
                cands = [l.name().lower().replace('_', ' ') for l in s.lemmas() if l.name().lower().replace('_', ' ') in syllabus_all]
                if len(cands) < 4:
                    for hyp in s.hypernyms()[:1]:
                        for child in hyp.hyponyms()[:15]:
                            for l in child.lemmas():
                                name = l.name().lower().replace('_', ' ')
                                if name in syllabus_all and name not in cands:
                                    cands.append(name)
                                    if len(cands) >= 15:
                                        break
                unique_cands = list(dict.fromkeys(cands))
                if len(unique_cands) >= 4 and w in unique_cands:
                    other_cands = [x for x in unique_cands if x != w]
                    other_cands.sort(key=lambda x: (x not in tem8_words, len(x)))
                    selected = [w] + other_cands[:3]
                    selected_key = tuple(sorted(selected))
                    if selected_key not in used_groups and w not in used_targets:
                        used_groups.add(selected_key)
                        used_targets.add(w)
                        t8_c = sum(1 for x in selected if x in tem8_words)
                        final_clusters.append({
                            "group_id": len(final_clusters) + 1,
                            "group_name": ", ".join(selected),
                            "target_word": w,
                            "words": selected,
                            "pos": "v",
                            "field": infer_field(selected, s.definition()),
                            "primary_mechanism": infer_mech(selected, s.definition()),
                            "theme_label": f"{w} 与近义词辨析",
                            "synset_definition": s.definition(),
                            "t8_count": t8_c,
                            "cas_score": calculate_cas(selected, s, tem8_words, 'v')
                        })
                        break

    print(f"Total clusters assembled: {len(final_clusters)}")
    t8_in_all = sum(c["t8_count"] for c in final_clusters)
    total_opts = len(final_clusters) * 4
    print(f"TEM-8 option purity: {t8_in_all}/{total_opts} ({t8_in_all/total_opts:.1%})")

    # Output clusters to tem8_clusters_750.json
    out_file = os.path.join(os.path.dirname(__file__), "tem8_clusters_750.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_clusters, f, ensure_ascii=False, indent=2)
    print(f"Saved 750 clusters to {out_file}")

    # Slice into 75 chunks (10 clusters per chunk)
    chunks_dir = os.path.join(os.path.dirname(__file__), "chunks")
    os.makedirs(chunks_dir, exist_ok=True)

    batch_size = 10
    total_batches = (len(final_clusters) + batch_size - 1) // batch_size
    state_records = {}

    for b_idx in range(total_batches):
        batch_slice = final_clusters[b_idx * batch_size : (b_idx + 1) * batch_size]
        chunk_file = os.path.join(chunks_dir, f"chunk_{b_idx:02d}.json")
        with open(chunk_file, "w", encoding="utf-8") as f:
            json.dump({
                "batch_id": b_idx,
                "chunk_name": f"chunk_{b_idx:02d}",
                "clusters_count": len(batch_slice),
                "questions_target": len(batch_slice) * 2,
                "clusters": batch_slice
            }, f, ensure_ascii=False, indent=2)

        state_records[f"batch_{b_idx:02d}"] = {
            "batch_id": b_idx,
            "status": "PENDING",
            "cluster_count": len(batch_slice),
            "question_target": len(batch_slice) * 2,
            "questions_verified": 0,
            "retry_count": 0,
            "last_updated": None,
            "error_log": []
        }

    # Save state
    state_dir = os.path.join(os.path.dirname(__file__), "state")
    os.makedirs(state_dir, exist_ok=True)
    state_file = os.path.join(state_dir, "batches_state.json")
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state_records, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated {total_batches} chunk files in {chunks_dir} and initialized state in {state_file}.")

if __name__ == "__main__":
    build_top_750_clusters()
