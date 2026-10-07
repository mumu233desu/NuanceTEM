import json
import os
import re
import sys

# TEM-8 自动化质检守门员 (Sanity Gatekeeper)
VALID_MECHS = {'MECH_COLLOCATION', 'MECH_CONNOTATION', 'MECH_REGISTER', 'MECH_NUANCE'}
VALID_FIELDS = {'FIELD_CHANGE', 'FIELD_STANCE', 'FIELD_COGNITION', 'FIELD_BEHAVIOR', 'FIELD_RELATION', 'FIELD_NATURE'}

def verify_question(q, idx):
    errors = []
    prefix = f"[Item {idx} (ID: {q.get('id', 'N/A')})]"

    # 1. 必填字段检测
    required_keys = ['id', 'group_id', 'group_name', 'level', 'target_word', 'question', 'options', 'answer', 'primary_mechanism', 'field', 'anchor_clue', 'distractor_analysis', 'translation']
    for k in required_keys:
        if k not in q or q[k] is None or q[k] == '':
            errors.append(f"{prefix} Missing required key: {k}")

    # 2. Level 检查
    if q.get('level') != 'TEM-8':
        errors.append(f"{prefix} Expected level 'TEM-8', got: {q.get('level')}")

    # 3. 考点机制与语义场
    if q.get('primary_mechanism') not in VALID_MECHS:
        errors.append(f"{prefix} Invalid primary_mechanism: {q.get('primary_mechanism')}")
    if q.get('field') not in VALID_FIELDS:
        errors.append(f"{prefix} Invalid field: {q.get('field')}")

    # 4. 选项与答案核验 (支持单词与短语，归一化空格)
    options = q.get('options', [])
    if not isinstance(options, list) or len(options) != 4:
        errors.append(f"{prefix} Options must be a list of exactly 4 items, got: {len(options) if isinstance(options, list) else type(options)}")
    else:
        norm_opts = [re.sub(r'\s+', ' ', str(opt)).strip() for opt in options]
        if len(set(norm_opts)) != 4:
            errors.append(f"{prefix} Options contain duplicates: {norm_opts}")
        
        raw_ans = re.sub(r'\s+', ' ', str(q.get('answer', ''))).strip()
        # 答案必须在选项中（不区分大小写比较）
        norm_opts_lower = [o.lower() for o in norm_opts]
        if raw_ans.lower() not in norm_opts_lower:
            errors.append(f"{prefix} Answer '{raw_ans}' not found in options: {norm_opts}")

    # 5. 题干长度与挖空核验
    question = q.get('question', '')
    if '___' not in question:
        errors.append(f"{prefix} Question text must contain '___' cloze blank.")
    
    words = question.split()
    if len(words) < 16:
        errors.append(f"{prefix} Question too short ({len(words)} words). TEM-8 questions must be >= 16 words scholarly sentences.")

    # 6. 锚点与解析深度核验
    anchor = q.get('anchor_clue', '')
    if len(anchor) < 12:
        errors.append(f"{prefix} anchor_clue too brief ({len(anchor)} chars). Must explain decisive clue.")

    analysis = q.get('distractor_analysis', {})
    if not isinstance(analysis, dict):
        errors.append(f"{prefix} distractor_analysis must be a dict.")
    elif isinstance(options, list) and len(options) == 4:
        for opt in options:
            opt_str = str(opt).strip()
            # 允许严格或小写键
            matching_key = None
            for k in analysis.keys():
                if k.strip().lower() == opt_str.lower():
                    matching_key = k
                    break
            if not matching_key:
                errors.append(f"{prefix} distractor_analysis missing explanation for option '{opt_str}'")
            elif len(str(analysis[matching_key])) < 8:
                errors.append(f"{prefix} Explanation for '{opt_str}' too brief.")

    # 7. 译文核验
    trans = q.get('translation', '')
    if len(trans) < 8:
        errors.append(f"{prefix} translation too brief ({len(trans)} chars).")

    return errors

def verify_batch(file_path):
    if not os.path.exists(file_path):
        return False, [f"File not found: {file_path}"]

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return False, [f"JSON parse error: {e}"]

    if not isinstance(data, list):
        return False, ["Batch data must be a JSON array."]

    all_errors = []
    seen_ids = set()
    for idx, item in enumerate(data):
        item_id = item.get('id')
        if item_id in seen_ids:
            all_errors.append(f"Duplicate ID found in batch: {item_id}")
        seen_ids.add(item_id)
        
        errs = verify_question(item, idx)
        all_errors.extend(errs)

    is_valid = len(all_errors) == 0
    return is_valid, all_errors

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_tem8_batch.py <batch_file.json>")
        sys.exit(1)
        
    path = sys.argv[1]
    valid, errors = verify_batch(path)
    if valid:
        print(f"VERIFICATION PASSED: {path} is 100% compliant!")
        sys.exit(0)
    else:
        print(f"VERIFICATION FAILED: Found {len(errors)} errors in {path}:")
        for err in errors[:15]:
            print("  *", err)
        if len(errors) > 15:
            print(f"  ... and {len(errors) - 15} more errors.")
        sys.exit(1)
