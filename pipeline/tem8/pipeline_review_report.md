# Comprehensive Code Review Report: TEM-8 LLM Question Generation & Verification Pipeline

**Project**: NuanceTEM (`E:/Coding/NuanceTEM/pipeline/tem8/`)  
**Scope**: Full LLM pipeline (`config.py`, `client.py`, `cache.py`, `prompts.py`, `verifier.py`, `reviewer.py`, `generator.py`, `manage.py`, data chunks & state)  
**Date**: 2026-10-14  
**Audit Status**: Complete Forensic Analysis  

---

## 1. Executive Summary

A comprehensive architectural and line-by-line code review was conducted on the TEM-8 question generation and verification pipeline. The system exhibits a sophisticated two-tier quality architecture (Layer 1 Rule Gatekeeper + Layer 2 LLM Critic Reviewer) and a 75-batch chunking strategy (1,500 questions total).

However, the implementation contains **critical failure modes, fail-open vulnerabilities, cache poisoning bugs, and state desynchronizations** that compromise question quality, allow unverified questions to enter production datasets, and risk deadlock during automated batch generation.

### Summary of Discovered Issues by Severity

| ID | Severity | File | Line(s) | Description |
|---|---|---|---|---|
| **BUG-01** | **CRITICAL** | `llm/reviewer.py` | 43–46 | **Reviewer Fail-Open Vulnerability**: Exception block returns `True`, silently passing defective questions when review fails or times out. |
| **BUG-02** | **CRITICAL** | `llm/generator.py` | 86–87, 131–146 | **Repair Failure Returns Broken Question & Appends to Verified List**: `_repair_question` returns `curr_q` instead of `None` on failure; `process_cluster` unconditionally appends failing questions. |
| **BUG-03** | **CRITICAL** | `llm/client.py`<br>`llm/cache.py` | 54–58<br>8–65 | **Cache Poisoning with Unvalidated Content**: Raw responses are cached before JSON parsing/verification; no cache invalidation/eviction mechanism exists. |
| **BUG-04** | **CRITICAL** | `llm/client.py` | 49–53 | **`aiohttp.ClientSession` Thrashing & Leaks**: A new session is instantiated on every retry attempt of every call, defeating connection pooling and risking socket exhaustion. |
| **BUG-05** | **MAJOR** | `llm/verifier.py` | 76–80 | **Word Count Punctuation Glitch**: Tokenizer check `w != "___"` fails when blank touches punctuation (`"___."`, `"___,"`), miscounting blanks as words. |
| **BUG-06** | **MAJOR** | `llm/generator.py` | 123–129 | **Silent Question Dropping (Under-generation)**: If LLM returns only 1 question, the pipeline accepts it without error or retry, silently truncating batches. |
| **BUG-07** | **MAJOR** | `llm/verifier.py`<br>`llm/generator.py` | 28–110<br>97–98 | **Cluster Context Blindness & ID Hallucination**: Verifier does not check options against the source cluster or enforce expected batch IDs (`tem8_bXX_YY`). |
| **BUG-08** | **MAJOR** | `llm/generator.py` | 184–203 | **Metric Deception**: Batch `pass_count` and `VERIFIED` status in `batches_state.json` completely ignore Layer 2 LLM review results. |
| **BUG-09** | **MAJOR** | `manage.py` | 116–139 | **`cmd_review` CLI Omission**: CLI `review` command only checks Layer 1 Python rules and completely skips Layer 2 LLM review. |
| **BUG-10** | **MAJOR** | `manage.py` | 146–170 | **All Partial Batches Discarded**: `cmd_merge` only loads `status == "VERIFIED"`, discarding all valid questions from `PARTIAL` batches with no selective repair path. |
| **BUG-11** | **MEDIUM** | `llm/cache.py` | 50–60 | **Synchronous Blocking Disk I/O in Async Loop**: Full cache dump to disk inside async completion; `os.replace` lock hazard on Windows. |
| **BUG-12** | **MEDIUM** | `llm/verifier.py` | 90–99 | **Distractor Analysis Key Fragility**: Fails if LLM includes trailing colon/punctuation in keys (e.g. `"mitigate:"`). |
| **BUG-13** | **MEDIUM** | `llm/verifier.py` | 82–83 | **Multiple Blanks Undetected**: Verifier only checks if `"___"` is present, not if `count("___") == 1`. |
| **BUG-14** | **MINOR** | `llm/config.py` | 8 | **Hardcoded Plaintext API Key**: Plaintext credential committed in source code. |
| **BUG-15** | **MINOR** | `verify_tem8_batch.py`<br>`llm/verifier.py` | 25–28, 51–53<br>28–110 | **Rule Divergence**: Separate standalone verifier has conflicting word count thresholds and checks mechanism/fields that `RuleVerifier` ignores. |
| **BUG-16** | **MINOR** | `chunks/` | N/A | **Legacy Chunk Artifacts**: Remnant `chunk_0.json`..`chunk_9.json` coexist with `chunk_00.json`..`chunk_74.json`. |

---

## 2. Deep Dive: Critical Severity Flaws

### BUG-01: Reviewer 'Fail Open' Vulnerability
- **File**: [`pipeline/tem8/llm/reviewer.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/reviewer.py#L43-L46)
- **Lines**: 43–46
- **Code**:
  ```python
  except Exception as e:
      # 审校 API 偶发解析错误时，记录日志并标记警告
      print(f"[Reviewer Warning] Failed to parse reviewer response for {q.get('id')}: {e}")
      return True, [f"Reviewer parse exception: {e}"]
  ```
- **Mechanism & Impact**:
  Layer 2 (`ExclusivityReviewer`) is the critic agent designed to evaluate whether a question possesses 100% indisputable exclusivity, robust anchor clues, and academic register.
  When an exception occurs (e.g. LLM API timeout after 180s, HTTP 500/429, malformed JSON response, or type mismatch when parsing `score`), the function catches the exception and **returns `True`**!
  In `generator.py`, `l2_ok, l2_errs = await self.reviewer.review_question(q)` evaluates `l2_ok == True`.
  As a result, **any failed, crashed, or unparseable review is treated as PASSED**. Defective questions with multiple plausible answers or fatal linguistic flaws silently bypass Layer 2 verification.
- **Remediation**:
  Must return `False, [f"Reviewer exception: {str(e)}"]`. Review failures must trigger targeted repair or mark the question as unverified.

---

### BUG-02: Generator Repair Failure Returns Broken Question & Unconditionally Appends
- **File**: [`pipeline/tem8/llm/generator.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/generator.py#L86-L87) and [`pipeline/tem8/llm/generator.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/generator.py#L131-L146)
- **Lines**: 86–87, 131–146
- **Code in `_repair_question`**:
  ```python
  print(f"      [Retry Failed] Could not repair {curr_q.get('id')} after {max_retries} attempts.")
  return curr_q
  ```
- **Code in `process_cluster`**:
  ```python
  verified_questions = []
  for q in questions[:2]:
      # Layer 1: Python 规则质检
      l1_ok, l1_errs = self.verifier.verify_question(q)
      if not l1_ok:
          repaired = await self._repair_question(q, cluster, l1_errs)
          if repaired:
              q = repaired

      # Layer 2: LLM 审校
      if enable_l2_review:
          l2_ok, l2_errs = await self.reviewer.review_question(q)
          if not l2_ok:
              repaired = await self._repair_question(q, cluster, l2_errs)
              if repaired:
                  q = repaired

      verified_questions.append(q)
  ```
- **Mechanism & Impact**:
  1. When all repair retries fail in `_repair_question`, the function returns `curr_q` (the original broken question) instead of `None`.
  2. In `process_cluster`, `if repaired:` evaluates to `True` because a non-empty dictionary is truthy! Thus, `q` remains the broken question.
  3. At line 145, `verified_questions.append(q)` executes **unconditionally**, without re-verifying `l1_ok` or `l2_ok`.
  4. The list is called `verified_questions`, but it actually contains failed, un-repaired questions.
  5. These failed questions are directly written into `batch_XX.json` on disk (line 195).
- **Remediation**:
  - `_repair_question` must return `None` when repair fails.
  - `process_cluster` must only append `q` if it passes both Layer 1 and Layer 2. If repair fails, `q` must be flagged as rejected or dropped, and logged in errors.

---

### BUG-03: Cache Poisoning with Unvalidated Raw Content
- **File**: [`pipeline/tem8/llm/client.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/client.py#L54-L58), [`pipeline/tem8/llm/cache.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/cache.py#L8-L65)
- **Lines**: `client.py:54–58`, `cache.py:46–61`
- **Code in `client.py`**:
  ```python
  if resp.status == 200:
      res_json = await resp.json()
      content = res_json["choices"][0]["message"]["content"]
      if use_cache:
          self.cache.set(cache_key, content)
      return content
  ```
- **Mechanism & Impact**:
  1. `client.chat_completion` caches the raw string response immediately upon receiving HTTP 200, *before* JSON extraction, schema validation, or quality verification.
  2. If the LLM generates truncated text (e.g., hit `max_tokens`), invalid JSON, conversational refusal, or hallucinated content, it is saved into `llm_cache.json`.
  3. `ResponseCache` provides no `delete(key)` or `invalidate(key)` method.
  4. When the user or `manage.py run-all` retries the batch, `chat_completion` immediately returns the cached invalid string. `extract_json` raises `ValueError` again.
  5. **Verification**: Live forensic inspection of `llm_cache.json` revealed key `3c8cdb96f6` storing `"Pong! How can I help you today?"`, which permanently crashes `extract_json`. Any batch hitting a poisoned key is trapped in a permanent failure loop until manual disk file editing.
- **Remediation**:
  - Caching should occur *after* validation or parsing succeeds, OR `ResponseCache` must support `evict(key)` so `generator.py` can invalidate the cache entry when `extract_json` or verification fails.

---

### BUG-04: `aiohttp.ClientSession` Thrashing & Leaks Per Attempt
- **File**: [`pipeline/tem8/llm/client.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/client.py#L49-L53)
- **Lines**: 49–53
- **Code**:
  ```python
  for attempt in range(1, CONFIG.max_retries + 1):
      try:
          timeout = aiohttp.ClientTimeout(total=CONFIG.timeout_seconds)
          async with aiohttp.ClientSession(timeout=timeout) as session:
              async with session.post(self.api_url, headers=self.headers, json=payload) as resp:
  ```
- **Mechanism & Impact**:
  - `aiohttp.ClientSession` is designed to be created once per application/client lifecycle to pool underlying TCP connections and perform DNS caching.
  - Creating and tearing down a `ClientSession` on *every single retry attempt of every single completion* destroys connection pooling.
  - On Windows, rapid creation and deletion of sockets leads to high numbers of sockets lingering in `TIME_WAIT` state, eventually exhausting ephemeral TCP ports (`WSAENOBUFS` / `EADDRINUSE` / WinError 10048) under high batch concurrency.
- **Remediation**:
  Manage a single reusable `ClientSession` on `LLMClient` with a lifecycle method (`async def close(self)` or `async with LLMClient()`).

---

## 3. Deep Dive: Major Severity Flaws

### BUG-05: Word Count Tokenizer Glitch (Cloze Blank with Trailing Punctuation)
- **File**: [`pipeline/tem8/llm/verifier.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/verifier.py#L76-L80)
- **Lines**: 76–80
- **Code**:
  ```python
  question_text = q["question"]
  words_in_q = [w for w in re.split(r"\s+", question_text.strip()) if w and w != "___"]
  word_count = len(words_in_q)
  if word_count < 20 or word_count > 38:
      errors.append(f"Question length ({word_count} words) is outside TEM-8 standard range [20, 38]")
  ```
- **Mechanism & Impact**:
  - In standard English sentence structure, cloze blanks are frequently followed by punctuation: `"The council chose to ___."`, `"Failing to ___, the minister resigned."`, `"She refused to ___; however, ..."`.
  - Splitting on `\s+` yields tokens like `"___."`, `"___,"`, `"___;"`.
  - Because `w != "___"` is an exact equality check, `"___." != "___"` evaluates to `True`.
  - The blank placeholder is counted as an actual word!
  - If a sentence has 38 words plus the blank with punctuation, it is calculated as 39 words and falsely rejected.
- **Remediation**:
  Strip punctuation or normalize the placeholder before word splitting:
  ```python
  cleaned_text = re.sub(r"___[.,;:?!]?", "", question_text)
  words_in_q = [w for w in re.split(r"\s+", cleaned_text.strip()) if w]
  ```

---

### BUG-06: Silent Under-generation When LLM Returns < 2 Questions
- **File**: [`pipeline/tem8/llm/generator.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/generator.py#L123-L129)
- **Lines**: 123–129
- **Code**:
  ```python
  raw_resp = await self.client.chat_completion(messages=messages, temperature=CONFIG.temperature)
  questions = extract_json(raw_resp)
  if not isinstance(questions, list):
      questions = [questions]
  ...
  verified_questions = []
  for q in questions[:2]:
  ```
- **Mechanism & Impact**:
  - If the LLM returns a single question JSON object or an array of length 1, `questions[:2]` contains only 1 element.
  - `process_cluster` completes with `len(verified_questions) == 1`.
  - The method does not detect that question 2 was never generated; it does not issue a prompt to generate the missing question.
  - The batch output `batch_XX.json` ends up with 19 or fewer questions, silently under-delivering against the target of 20 questions per batch.
- **Remediation**:
  Explicitly check `if len(questions) < 2:` and trigger targeted generation for the missing question (specifically targeting `target_2` and `q_id_2`).

---

### BUG-07: Cluster Context Blindness & ID Hallucination
- **Files**: [`pipeline/tem8/llm/verifier.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/verifier.py#L28-L74), [`pipeline/tem8/llm/generator.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/generator.py#L97-L98)
- **Lines**: `verifier.py:28–74`, `generator.py:97–98`
- **Mechanism & Impact**:
  1. `RuleVerifier.verify_question(self, q)` does NOT accept the source `cluster` dict. It only verifies that the 4 options are in `self.syllabus_all` (12,097 words).
  2. If the LLM hallucinates and replaces cluster distractors with arbitrary syllabus words (e.g. replacing `mitigate` with `apple`), `RuleVerifier` cannot catch it!
  3. `q_id_1` and `q_id_2` (`tem8_bXX_YY`) are suggested in the prompt, but `generator.py` never overrides `q["id"] = expected_id`. If the LLM invents custom IDs (`"id": "1"`, `"id": "tem8_01"`), downstream merge deduplication in `manage.py` (`seen_ids.add(q["id"])`) collides and silently drops questions.
- **Remediation**:
  - Pass `cluster` into `verify_question(q, cluster)` and enforce `set(opt.lower() for opt in q["options"]) == set(w.lower() for w in cluster["words"])`.
  - In `generator.py`, explicitly overwrite `q["id"] = expected_id` to guarantee rigid naming conformity.

---

### BUG-08: Batch `pass_count` & `VERIFIED` Status Completely Ignore Layer 2
- **File**: [`pipeline/tem8/llm/generator.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/generator.py#L184-L203)
- **Lines**: 184–203
- **Code**:
  ```python
  # 统计合格率
  pass_count = 0
  for q in batch_questions:
      l1_ok, _ = self.verifier.verify_question(q)
      if l1_ok:
          pass_count += 1
  ...
  status = "VERIFIED" if verified_count >= target_count else ("PARTIAL" if verified_count > 0 else "FAILED")
  ```
- **Mechanism & Impact**:
  - When tallying `pass_count` to determine batch status in `run_batch`, the code only tests `l1_ok` (Layer 1 RuleVerifier).
  - Layer 2 reviewer results are completely excluded from the metric.
  - If Layer 2 rejected all 20 questions, but Layer 1 passed them, `pass_count` is 20 and the batch is marked `"VERIFIED"` in `batches_state.json`.
- **Remediation**:
  Store verification flags on each question (`q["_l1_passed"]`, `q["_l2_passed"]`), and only increment `pass_count` if both Layer 1 and Layer 2 (when enabled) are `True`.

---

### BUG-09: `cmd_review` CLI Omission of Layer 2
- **File**: [`pipeline/tem8/manage.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/manage.py#L116-L139)
- **Lines**: 116–139
- **Mechanism & Impact**:
  - `python manage.py review --batch 0` claims to re-review a generated batch.
  - It only initializes `RuleVerifier()` and runs Python rule checks.
  - It does NOT run `ExclusivityReviewer` (Layer 2 LLM Reviewer).
  - Furthermore, its word count check (`len(q['question'].split())`) does not match the verifier logic.
- **Remediation**:
  Support `--l2` flag in `cmd_review` to optionally invoke `ExclusivityReviewer` on the batch.

---

### BUG-10: `manage.py merge` Discards All Partial Batches
- **File**: [`pipeline/tem8/manage.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/manage.py#L146-L170)
- **Lines**: 146–170
- **Mechanism & Impact**:
  - `cmd_merge` only selects batches where `status == "VERIFIED"`.
  - If a batch has 19 valid questions and 1 invalid question (`status == "PARTIAL"`), all 19 valid questions are completely omitted from the production build.
  - Furthermore, `manage.py` has no `repair` subcommand to re-generate just the 1 failing question of a `PARTIAL` batch.
- **Remediation**:
  Add a targeted repair command for partial batches, or allow `merge` to collect verified individual questions across all batches.

---

## 4. Medium & Minor Severity Issues

### BUG-11: Synchronous Blocking Disk I/O in Async Loop (`cache.py`)
- **File**: [`pipeline/tem8/llm/cache.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/cache.py#L50-L60)
- **Lines**: 50–60
- On every single completion, `self.cache.set()` executes `json.dump` of the entire cache and `os.replace` synchronously inside `threading.Lock()`.
- This blocks the asyncio event loop. Under concurrent calls on Windows, `os.replace` can trigger `PermissionError: [WinError 32]` if another thread or file indexing service holds a handle.

### BUG-12: Distractor Analysis Key Punctuation Fragility (`verifier.py`)
- **File**: [`pipeline/tem8/llm/verifier.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/verifier.py#L90-L99)
- If the LLM generates distractor analysis keys with trailing punctuation or colons (e.g. `{"mitigate:": "..."}` or `{"mitigate (v.)": "..."}`), the exact string comparison `k.lower().strip() == opt_str.lower()` fails, causing false rejection.

### BUG-13: Multiple Blanks Undetected (`verifier.py`)
- **File**: [`pipeline/tem8/llm/verifier.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/verifier.py#L82-L83)
- Line 82 checks `if "___" not in question_text:`. It does not check if `question_text.count("___") != 1`. A question with 2 blanks will pass verification.

### BUG-14: Hardcoded Plaintext API Key (`config.py`)
- **File**: [`pipeline/tem8/llm/config.py`](file:///E:/Coding/NuanceTEM/pipeline/tem8/llm/config.py#L8)
- `api_key: str = "sk-c1c7dbb68c714d3399a14b05ca9906d6"` is committed in plaintext. Should fallback to `os.getenv("LLM_API_KEY")`.

### BUG-15: Divergence with `verify_tem8_batch.py`
- `verify_tem8_batch.py` enforces `len(words) >= 16`, `anchor_clue >= 12`, `primary_mechanism in VALID_MECHS`, and `field in VALID_FIELDS`.
- `RuleVerifier` enforces `20 <= words <= 38`, `anchor_clue >= 6`, but fails to validate `primary_mechanism` or `field` against the enumerated sets.

### BUG-16: Residual Ghost Chunks in `chunks/`
- `chunks/` contains 85 files: `chunk_0.json`..`chunk_9.json` (from old 10-chunk run) alongside `chunk_00.json`..`chunk_74.json` (75 batches).
- Leaving unpadded `chunk_0.json` risks loading the wrong cluster data if scripts omit zero-padding.

---

## 5. Prioritized Remediation Plan & Code Patches

### Patch 1: Fix Reviewer Fail-Open (`llm/reviewer.py`)
```python
<<<<
        except Exception as e:
            # 审校 API 偶发解析错误时，记录日志并标记警告
            print(f"[Reviewer Warning] Failed to parse reviewer response for {q.get('id')}: {e}")
            return True, [f"Reviewer parse exception: {e}"]
====
        except Exception as e:
            print(f"[Reviewer Error] Reviewer failed for {q.get('id')}: {e}")
            return False, [f"Reviewer execution exception: {str(e)}"]
>>>>
```

### Patch 2: Fix Generator Repair & False Append (`llm/generator.py`)
```python
<<<<
        print(f"      [Retry Failed] Could not repair {curr_q.get('id')} after {max_retries} attempts.")
        return curr_q
====
        print(f"      [Retry Failed] Could not repair {curr_q.get('id')} after {max_retries} attempts.")
        return None
>>>>
```
And in `process_cluster`:
```python
<<<<
        verified_questions = []
        for q in questions[:2]:
            # Layer 1: Python 规则质检
            l1_ok, l1_errs = self.verifier.verify_question(q)
            if not l1_ok:
                repaired = await self._repair_question(q, cluster, l1_errs)
                if repaired:
                    q = repaired

            # Layer 2: LLM 审校
            if enable_l2_review:
                l2_ok, l2_errs = await self.reviewer.review_question(q)
                if not l2_ok:
                    repaired = await self._repair_question(q, cluster, l2_errs)
                    if repaired:
                        q = repaired

            verified_questions.append(q)
====
        verified_questions = []
        for idx_q, q in enumerate(questions[:2]):
            expected_id = q_id_1 if idx_q == 0 else q_id_2
            q["id"] = expected_id  # Enforce expected ID

            # Layer 1: Python 规则质检
            l1_ok, l1_errs = self.verifier.verify_question(q, cluster)
            if not l1_ok:
                repaired = await self._repair_question(q, cluster, l1_errs)
                if repaired:
                    q = repaired
                    l1_ok = True
                else:
                    continue  # Drop unrepairable question

            # Layer 2: LLM 审校
            if enable_l2_review:
                l2_ok, l2_errs = await self.reviewer.review_question(q)
                if not l2_ok:
                    repaired = await self._repair_question(q, cluster, l2_errs)
                    if repaired:
                        q = repaired
                        l2_ok = True
                    else:
                        continue  # Drop unrepairable question

            verified_questions.append(q)
>>>>
```

### Patch 3: Fix Cache Poisoning & Add Invalidation (`llm/cache.py`, `llm/client.py`)
In `cache.py`, add `evict(key)`:
```python
    def evict(self, key: str):
        with self._lock:
            if key in self.cache_data:
                del self.cache_data[key]
                tmp_file = self.cache_file + ".tmp"
                try:
                    with open(tmp_file, "w", encoding="utf-8") as f:
                        json.dump(self.cache_data, f, ensure_ascii=False)
                    os.replace(tmp_file, self.cache_file)
                except Exception as e:
                    print(f"[Cache] Error evicting key: {e}")
```
In `client.py`, return `cache_key` or expose eviction on parse failure.

### Patch 4: Fix Tokenizer Punctuation Glitch & Single Blank (`llm/verifier.py`)
```python
<<<<
        question_text = q["question"]
        words_in_q = [w for w in re.split(r"\s+", question_text.strip()) if w and w != "___"]
        word_count = len(words_in_q)
        if word_count < 20 or word_count > 38:
            errors.append(f"Question length ({word_count} words) is outside TEM-8 standard range [20, 38]")

        if "___" not in question_text:
            errors.append("Question missing blank placeholder '___'")
====
        question_text = q["question"]
        blank_matches = re.findall(r"___+", question_text)
        if len(blank_matches) != 1:
            errors.append(f"Question must contain exactly one cloze blank '___', found {len(blank_matches)}")

        # Normalize cloze blank and attached punctuation for word counting
        cleaned_text = re.sub(r"___+[.,;:?!]?", "", question_text)
        words_in_q = [w for w in re.split(r"\s+", cleaned_text.strip()) if w]
        word_count = len(words_in_q)
        if word_count < 20 or word_count > 38:
            errors.append(f"Question length ({word_count} words) is outside TEM-8 standard range [20, 38]")
>>>>
```

### Patch 5: Fix Connection Pooling in `LLMClient` (`llm/client.py`)
```python
class LLMClient:
    def __init__(self, concurrency: int = CONFIG.default_concurrency):
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)
        self.cache = ResponseCache()
        self.api_url = f"{CONFIG.api_base_url.rstrip('/')}/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {CONFIG.api_key}",
            "Content-Type": "application/json"
        }
        self._session: Optional[aiohttp.ClientSession] = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=CONFIG.timeout_seconds)
            connector = aiohttp.TCPConnector(limit=self.concurrency * 2, keepalive_timeout=60)
            self._session = aiohttp.ClientSession(timeout=timeout, connector=connector)
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
```
