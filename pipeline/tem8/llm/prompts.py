import json
import re
from typing import Any, Dict, List, Optional

def extract_json(text: str) -> Any:
    """鲁棒的 JSON 提取器，可自动容忍并剥离 Markdown 代码块与杂乱前后缀"""
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass

    # 1. 优先提取 ```json ... ``` 代码块内容
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fenced:
        try:
            return json.loads(fenced.group(1).strip())
        except Exception:
            pass

    # 2. 尝试贪婪匹配最外层的 [ { ... } ]
    match_arr = re.search(r"\[\s*\{[\s\S]*\}\s*\]", text)
    if match_arr:
        try:
            return json.loads(match_arr.group(0))
        except Exception:
            pass

    # 3. 尝试贪婪匹配最外层的 { ... }
    match_obj = re.search(r"\{[\s\S]*\}", text)
    if match_obj:
        try:
            return json.loads(match_obj.group(0))
        except Exception:
            pass

    raise ValueError(f"Could not extract valid JSON from response (length {len(text)}):\n{text[:300]}")

# 1. 命题专家 System Prompt
SYSTEM_PROMPT_GENERATOR = """You are a Senior Chief Examiner for the National TEM-8 (Test for English Majors - Band 8) and an expert Corpus Linguist specializing in Advanced Academic English, Stylistic Register, and Lexical Semantics.

Your core mission is to create authentic, discriminating, and rigorous TEM-8 vocabulary questions based on the provided synonym clusters and Merriam-Webster lexicographical data.

CRITICAL RULES & RED LINES:
1. OPTION PURITY: All 4 options MUST strictly match the exact words provided in the cluster. NEVER substitute or invent new words. NEVER introduce informal slang or out-of-syllabus terms.
2. TARGET WORD & ANSWER: The target word must be the correct answer. It is 100% a certified TEM-8 starred syllabus word.
3. SENTENCE LENGTH & QUALITY:
   - The sentence MUST be between 20 and 38 words (excluding the blank '___').
   - Authentic academic journal / high-end journalism texture (echoing The Economist, Foreign Affairs, Nature, Oxford/Cambridge university presses).
   - Rich subordination, formal noun phrases, and sophisticated discursive logic.
4. DEFINITE EXCLUSIVITY (决定性排他锚点):
   - The sentence MUST contain an unequivocal linguistic anchor (Anchor Clue).
   - Substituting any of the other 3 distractors MUST result in a clear syntactic violation (e.g. prepositional mismatch), severe collocational rupture, stylistic clash, or logical connotation inversion.
   - A native English professor or expert examiner must readily agree that ONLY the target answer fits.
5. 4-OPTION DISTRACTOR ANALYSIS:
   - Provide meticulous Chinese analyses for ALL 4 options.
   - For the correct option: explain why it perfectly fits the syntactic anchor and discourse register.
   - For each distractor: explicitly demonstrate why it is invalid in this exact sentence context (citing prepositional selection, nuance, register, or polarity).
6. OUTPUT FORMAT:
   - Return a strictly valid JSON array of question objects.
   - DO NOT wrap in Markdown code blocks (no ```json, no conversational preamble). Raw JSON only."""

# 2. 命题 User Prompt 构造函数
def build_generator_user_prompt(
    cluster: Dict[str, Any],
    q_id_1: str,
    q_id_2: str,
    mw_examples: List[str],
    mw_defs: Optional[List[str]] = None,
    secondary_target: Optional[str] = None
) -> str:
    words_str = ", ".join(cluster["words"])
    target_1 = cluster["target_word"]
    target_2 = secondary_target or target_1

    mw_ex_text = "\n".join([f"- {ex}" for ex in mw_examples[:5]]) if mw_examples else "None available (rely on standard dictionary definitions)."
    mw_def_text = "\n".join([f"- {d}" for d in (mw_defs or [])[:3]]) if mw_defs else cluster.get('synset_definition', '')

    prompt = f"""Please generate exactly 2 distinct TEM-8 examination questions for the following synonym cluster:

[CLUSTER METADATA]
- Cluster Words: {words_str} (All 4 must appear as options)
- Primary Target Word: {target_1} (100% TEM-8 starred)
- Secondary Target Word: {target_2} (100% TEM-8 starred)
- Part of Speech: {cluster['pos']}
- Functional Discourse Field: {cluster.get('field', 'FIELD_COGNITION')}
- Primary Mechanism: {cluster.get('primary_mechanism', 'MECH_NUANCE')}
- Theme: {cluster.get('theme_label', '')}

[AUTHENTIC MERRIAM-WEBSTER DEFINITIONS & EXAMPLES]
Official MW Definitions:
{mw_def_text}

Full Authentic Examples & Publications (Uncut):
{mw_ex_text}

[REQUIREMENTS FOR THE 2 QUESTIONS]
- Question 1 (ID: "{q_id_1}"): Focus primarily on the primary mechanism ({cluster.get('primary_mechanism', 'MECH_COLLOCATION')}). Target answer: "{target_1}".
- Question 2 (ID: "{q_id_2}"): Focus on a complementary nuance or secondary context. Target answer: "{target_2}". All 4 options remain [{words_str}].

Output a JSON array containing the 2 question objects with exact fields:
[
  {{
    "id": "{q_id_1}",
    "group_id": {cluster['group_id']},
    "group_name": "{words_str}",
    "level": "TEM-8",
    "target_word": "{target_1}",
    "question": "The sentence with exactly one '___' placeholder and 20~38 words...",
    "options": ["{cluster['words'][0]}", "{cluster['words'][1]}", "{cluster['words'][2]}", "{cluster['words'][3]}"],
    "answer": "{target_1}",
    "primary_mechanism": "{cluster.get('primary_mechanism', 'MECH_COLLOCATION')}",
    "field": "{cluster.get('field', 'FIELD_COGNITION')}",
    "anchor_clue": "Decisive anchor clue explaining why other 3 options are strictly excluded...",
    "distractor_analysis": {{
      "{cluster['words'][0]}": "Detailed explanation...",
      "{cluster['words'][1]}": "Detailed explanation...",
      "{cluster['words'][2]}": "Detailed explanation...",
      "{cluster['words'][3]}": "Detailed explanation..."
    }},
    "translation": "Accurate and elegant Chinese translation of the sentence."
  }},
  {{
    "id": "{q_id_2}",
    "group_id": {cluster['group_id']},
    "group_name": "{words_str}",
    "level": "TEM-8",
    "target_word": "{target_2}",
    "question": "A distinct sentence with exactly one '___' placeholder and 20~38 words...",
    "options": ["{cluster['words'][0]}", "{cluster['words'][1]}", "{cluster['words'][2]}", "{cluster['words'][3]}"],
    "answer": "{target_2}",
    "primary_mechanism": "{cluster.get('primary_mechanism', 'MECH_NUANCE')}",
    "field": "{cluster.get('field', 'FIELD_COGNITION')}",
    "anchor_clue": "Decisive anchor clue for target 2...",
    "distractor_analysis": {{
      "{cluster['words'][0]}": "Detailed explanation...",
      "{cluster['words'][1]}": "Detailed explanation...",
      "{cluster['words'][2]}": "Detailed explanation...",
      "{cluster['words'][3]}": "Detailed explanation..."
    }},
    "translation": "Accurate and elegant Chinese translation of the sentence."
  }}
]"""
    return prompt

def build_single_generator_user_prompt(
    cluster: Dict[str, Any],
    q_id: str,
    target_word: str,
    mw_examples: List[str],
    mw_defs: Optional[List[str]] = None,
    primary_mechanism: Optional[str] = None
) -> str:
    words_str = ", ".join(cluster["words"])
    mech = primary_mechanism or cluster.get("primary_mechanism", "MECH_COLLOCATION")
    mw_ex_text = "\n".join([f"- {ex}" for ex in mw_examples[:5]]) if mw_examples else "None available (rely on standard dictionary definitions)."
    mw_def_text = "\n".join([f"- {d}" for d in (mw_defs or [])[:3]]) if mw_defs else cluster.get('synset_definition', '')

    prompt = f"""Please generate exactly 1 TEM-8 examination question for the following synonym cluster:

[CLUSTER METADATA]
- Cluster Words: {words_str} (All 4 must appear as options)
- Target Word: {target_word} (100% TEM-8 starred, MUST be the correct answer)
- Part of Speech: {cluster['pos']}
- Functional Discourse Field: {cluster.get('field', 'FIELD_COGNITION')}
- Primary Mechanism: {mech}
- Theme: {cluster.get('theme_label', '')}

[AUTHENTIC MERRIAM-WEBSTER DEFINITIONS & EXAMPLES]
Official MW Definitions:
{mw_def_text}

Full Authentic Examples & Publications (Uncut):
{mw_ex_text}

[REQUIREMENTS FOR THE QUESTION]
- Question ID: "{q_id}"
- Target answer: "{target_word}".
- All 4 options MUST strictly be [{words_str}].
- Focus primarily on {mech}.
- Decisive anchor clue and rigorous distractor analysis for all 4 options.

Output a single valid JSON question object with exact fields:
{{
  "id": "{q_id}",
  "group_id": {cluster['group_id']},
  "group_name": "{words_str}",
  "level": "TEM-8",
  "target_word": "{target_word}",
  "question": "The sentence with exactly one '___' placeholder and 20~38 words...",
  "options": ["{cluster['words'][0]}", "{cluster['words'][1]}", "{cluster['words'][2]}", "{cluster['words'][3]}"],
  "answer": "{target_word}",
  "primary_mechanism": "{mech}",
  "field": "{cluster.get('field', 'FIELD_COGNITION')}",
  "anchor_clue": "Decisive anchor clue explaining why other 3 options are strictly excluded...",
  "distractor_analysis": {{
    "{cluster['words'][0]}": "Detailed explanation...",
    "{cluster['words'][1]}": "Detailed explanation...",
    "{cluster['words'][2]}": "Detailed explanation...",
    "{cluster['words'][3]}": "Detailed explanation..."
  }},
  "translation": "Accurate and elegant Chinese translation of the sentence."
}}"""
    return prompt

# 3. 审校专家 System Prompt (Layer 2 LLM Reviewer)
SYSTEM_PROMPT_REVIEWER = """You are a Rigorous Academic Peer Reviewer and Senior Psychometrician for the TEM-8 national test committee.

Your job is to objectively critique and audit a generated TEM-8 vocabulary question.
Evaluate with high standards:
1. EXCLUSIVITY CHECK: Is the designated answer truly the ONLY acceptable word among the 4 options? Could any other option be considered acceptable or plausible in an educated native context?
2. ANCHOR ROBUSTNESS: Does the sentence feature a decisive linguistic anchor (preposition selection, semantic prosody, specific institutional register)?
3. SENTENCE NATURALNESS: Does the sentence read like authentic prose from The Economist, Foreign Affairs, or an academic press?
4. DISTRACTOR ANALYSIS: Are the explanations for all 4 options linguistically sound and accurate?

Return a JSON object:
{
  "passed": true / false,
  "score": 1 to 10,
  "issues": ["list of critical issues if passed is false, else empty"],
  "suggestion": "concrete advice for repair if needed"
}
Raw JSON only. No markdown formatting."""

def build_reviewer_user_prompt(q: Dict[str, Any]) -> str:
    return f"""Please review the following TEM-8 vocabulary question:

{json.dumps(q, ensure_ascii=False, indent=2)}

Determine whether this question possesses 100% indisputable exclusivity and authentic academic register."""

# 4. 靶向重试 Prompt 构造函数 (Targeted Repair Prompt)
def build_retry_user_prompt(
    previous_q: Dict[str, Any],
    error_reasons: List[str],
    cluster: Dict[str, Any]
) -> str:
    words_str = ", ".join(cluster["words"])
    err_list = "\n".join([f"- {e}" for e in error_reasons])
    return f"""The previous question failed quality review due to the following specific violations:

[DETECTED ISSUES]
{err_list}

[ORIGINAL QUESTION]
{json.dumps(previous_q, ensure_ascii=False, indent=2)}

[REPAIR INSTRUCTIONS]
1. Fix all issues mentioned above.
2. Target word: "{previous_q.get('target_word', cluster['target_word'])}".
3. Options MUST strictly be: [{words_str}]. Do NOT alter options!
4. Sentence length MUST strictly be between 20 and 38 words.
5. Provide decisive Anchor Clue and complete distractor analysis for all 4 options.

Return the single corrected question object in valid JSON format. Raw JSON only."""
