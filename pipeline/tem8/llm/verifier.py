import json
import os
import re
from typing import Any, Dict, List, Tuple
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

    def verify_question(self, q: Dict[str, Any]) -> Tuple[bool, List[str]]:
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

        # 2. 等级合规
        if q["level"] != "TEM-8":
            errors.append(f"Invalid level: '{q['level']}' (must be 'TEM-8')")

        # 3. 目标考点词必须 100% 属于专八标星词
        target = q["target_word"].lower().strip()
        if target not in self.tem8_words:
            errors.append(f"Target word '{target}' is NOT in official TEM-8 starred syllabus!")

        # 4. 答案必须与目标词一致
        answer = q["answer"].lower().strip()
        if answer != target:
            errors.append(f"Answer '{answer}' does not match target word '{target}'")

        # 5. 选项校验 (必须恰好 4 个不重复项)
        options = q["options"]
        if not isinstance(options, list) or len(options) != 4:
            errors.append(f"Options must be a list of 4 items, got: {len(options) if isinstance(options, list) else type(options)}")
        else:
            opt_lower = [str(o).lower().strip() for o in options]
            if len(set(opt_lower)) != 4:
                errors.append(f"Duplicate options detected: {opt_lower}")

            if target not in opt_lower:
                errors.append(f"Target word '{target}' is not present in options {opt_lower}")

            # 6. 大纲白名单硬过滤 (0 容忍超纲词)
            for opt in opt_lower:
                if opt not in self.syllabus_all:
                    errors.append(f"CRITICAL: Option '{opt}' is OUT OF SYLLABUS! (Not in 12,097 syllabus whitelist)")

        # 7. 题干词数检验 (20 ~ 38 词区间)
        question_text = q["question"]
        words_in_q = [w for w in re.split(r"\s+", question_text.strip()) if w and w != "___"]
        word_count = len(words_in_q)
        if word_count < 20 or word_count > 38:
            errors.append(f"Question length ({word_count} words) is outside TEM-8 standard range [20, 38]")

        if "___" not in question_text:
            errors.append("Question missing blank placeholder '___'")

        # 8. 4 选项逐项剖析完整性
        analysis = q.get("distractor_analysis", {})
        if not isinstance(analysis, dict):
            errors.append("distractor_analysis must be a dictionary")
        else:
            for opt in options:
                opt_str = str(opt).strip()
                # 兼容大小写 key
                found = False
                for k, v in analysis.items():
                    if k.lower().strip() == opt_str.lower() and v and len(str(v).strip()) >= 5:
                        found = True
                        break
                if not found:
                    errors.append(f"Missing or insufficient distractor analysis for option '{opt_str}'")

        # 9. 排他锚点与中文释义
        anchor = str(q.get("anchor_clue", "")).strip()
        if len(anchor) < 6:
            errors.append(f"Anchor clue '{anchor}' is too brief (must explain decisive exclusion clue)")

        trans = str(q.get("translation", "")).strip()
        if len(trans) < 8:
            errors.append("Translation is too short or missing")

        return len(errors) == 0, errors
