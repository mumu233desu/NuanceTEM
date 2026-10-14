import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple
from .config import CONFIG

class RuleVerifier:
    """
    第一层：Python 自动化守门员规则质检器。
    对大纲白名单、题干字数、排他锚点完备性执行一票否决。
    """
    def __init__(self):
        self.syllabus_cache_file = CONFIG.syllabus_cache_file
        self.tem8_words = set()
        self.tem4_words = set()
        self.syllabus_all = set()
        self._load_syllabus()

    def _load_syllabus(self):
        if not os.path.exists(self.syllabus_cache_file):
            raise FileNotFoundError(f"Syllabus cache not found at: {self.syllabus_cache_file}")
        with open(self.syllabus_cache_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.tem8_words = set(data["tem8_words"].keys())
        self.tem4_words = set(data["tem4_words"].keys())
        self.syllabus_all = self.tem8_words | self.tem4_words

    def verify_question(
        self,
        q: Dict[str, Any],
        cluster: Optional[Dict[str, Any]] = None,
        expected_id: Optional[str] = None
    ) -> Tuple[bool, List[str]]:
        errors = []

        # 1. 必填字段完整性
        required_fields = [
            "id", "group_id", "group_name", "level", "target_word",
            "question", "options", "answer", "primary_mechanism",
            "field", "anchor_clue", "distractor_analysis", "translation"
        ]
        for field in required_fields:
            if field not in q or q[field] is None or q[field] == "":
                errors.append(f"Missing or empty required field: '{field}'")

        if errors:
            return False, errors

        # 2. 题目 ID 严格校验
        if expected_id and q.get("id") != expected_id:
            errors.append(f"Question ID mismatch: expected '{expected_id}', got '{q.get('id')}'")

        # 3. 等级合规
        if q["level"] != "TEM-8":
            errors.append(f"Invalid level: '{q['level']}' (must be 'TEM-8')")

        # 4. 目标考点词必须 100% 属于专八标星词
        target = q["target_word"].lower().strip()
        if target not in self.tem8_words:
            errors.append(f"Target word '{target}' is NOT in official TEM-8 starred syllabus!")

        # 5. 答案必须与目标词一致
        answer = q["answer"].lower().strip()
        if answer != target:
            errors.append(f"Answer '{answer}' does not match target word '{target}'")

        # 6. 选项校验 (必须恰好 4 个不重复项，且全量属于大纲白名单)
        options = q["options"]
        if not isinstance(options, list) or len(options) != 4:
            errors.append(f"Options must be a list of 4 items, got: {len(options) if isinstance(options, list) else type(options)}")
        else:
            opt_lower = [str(o).lower().strip() for o in options]
            if len(set(opt_lower)) != 4:
                errors.append(f"Duplicate options detected: {opt_lower}")

            if target not in opt_lower:
                errors.append(f"Target word '{target}' is not present in options {opt_lower}")

            # 若提供了来源词群，严格校验 4 个选项必须 100% 等于该 Cluster 的 4 个单词
            if cluster and "words" in cluster:
                expected_cluster_words = set(str(w).lower().strip() for w in cluster["words"])
                if set(opt_lower) != expected_cluster_words:
                    errors.append(f"Options {opt_lower} do not strictly match cluster words {list(expected_cluster_words)}")

            # 大纲白名单硬过滤 (0 容忍超纲词)
            for opt in opt_lower:
                if opt not in self.syllabus_all:
                    errors.append(f"CRITICAL: Option '{opt}' is OUT OF SYLLABUS! (Not in 12,097 syllabus whitelist)")

        # 7. 题干词数检验 (20 ~ 38 词区间) 与严格挖空校验
        question_text = str(q["question"])
        blank_matches = re.findall(r"_{3,}", question_text)
        if len(blank_matches) != 1:
            errors.append(f"Question must contain exactly 1 blank placeholder '___', found {len(blank_matches)}")

        # 剔除挖空占位符及其粘连的标点符号，防止标点粘连导致字数误判虚增
        cleaned_text = re.sub(r"_{3,}[.,;:?!'\"“”‘’]*", "", question_text)
        words_in_q = [w for w in re.split(r"\s+", cleaned_text.strip()) if w]
        word_count = len(words_in_q)
        if word_count < 20 or word_count > 38:
            errors.append(f"Question length ({word_count} words) is outside TEM-8 standard range [20, 38]")

        # 8. 4 选项逐项剖析完整性 (容忍末尾冒号或词性说明标注)
        analysis = q.get("distractor_analysis", {})
        if not isinstance(analysis, dict):
            errors.append("distractor_analysis must be a dictionary")
        else:
            for opt in options:
                opt_str = str(opt).strip().lower()
                norm_opt = re.sub(r"[\s\:\(\)\[\]\.\,\-]+", "", opt_str)
                found = False
                for k, v in analysis.items():
                    norm_k = re.sub(r"[\s\:\(\)\[\]\.\,\-]+", "", str(k).lower())
                    if (norm_k == norm_opt or norm_k.startswith(norm_opt)) and v and len(str(v).strip()) >= 5:
                        found = True
                        break
                if not found:
                    errors.append(f"Missing or insufficient distractor analysis for option '{opt}'")

        # 9. 排他锚点与中文释义
        anchor = str(q.get("anchor_clue", "")).strip()
        if len(anchor) < 6:
            errors.append(f"Anchor clue '{anchor}' is too brief (must explain decisive exclusion clue)")

        trans = str(q.get("translation", "")).strip()
        if len(trans) < 8:
            errors.append("Translation is too short or missing")

        return len(errors) == 0, errors
