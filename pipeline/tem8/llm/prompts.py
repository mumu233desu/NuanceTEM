import json
from typing import Any, Dict, List, Optional

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
    mw_defs: Optional[List[str]] = None
) -> str:
    words_str = ", ".join(cluster["words"])
    mw_ex_text = "\n".join([f"- {ex}" for ex in mw_examples[:5]]) if mw_examples else "None available (rely on standard dictionary definitions)."
    mw_def_text = "\n".join([f"- {d}" for d in (mw_defs or [])[:3]]) if mw_defs else cluster.get('synset_definition', '')

    prompt = f"""Please generate exactly 2 distinct TEM-8 examination questions for the following synonym cluster:

[CLUSTER METADATA]
- Cluster Words: {words_str} (All 4 must appear as options)
- Primary Target Word: {cluster['target_word']}
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
- Question 1 (ID: "{q_id_1}"): Focus primarily on the primary mechanism ({cluster.get('primary_mechanism', 'MECH_COLLOCATION')}). Target answer: "{cluster['target_word']}".
- Question 2 (ID: "{q_id_2}"): Focus on a complementary nuance or secondary target word from the cluster: "{cluster['words'][1] if len(cluster['words']) > 1 else cluster['target_word']}". All 4 options remain [{words_str}].

Output a JSON array containing the 2 question objects with exact fields:
[
  {{
    "id": "{q_id_1}",
    "group_id": {cluster['group_id']},
    "group_name": "{words_str}",
    "level": "TEM-8",
    "target_word": "{cluster['target_word']}",
    "question": "The sentence with exactly one '___' placeholder and 20~38 words...",
    "options": ["{cluster['words'][0]}", "{cluster['words'][1]}", "{cluster['words'][2]}", "{cluster['words'][3]}"],
    "answer": "{cluster['target_word']}",
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
  ...
]"""
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
