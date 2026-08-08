# DUOLINGO_ROADMAP — research-derived proposals

**Status/authority note:** this file *proposes*; the repo-root **`ROADMAP.md` remains the single
source of truth** for the actual plan and is deliberately not modified by this analysis. Items
graduate into ROADMAP.md only when Flo adopts them — and items tagged **[Angelika]** additionally
require her pedagogical sign-off before any implementation (engineering never substitutes for it).
Evidence base: **`content/academia/duolingo/SYNTHESE.md`** (per-paper verdicts, 2026-08-08); paper
names below are shorthand for the summaries in that directory.

**Scope caveat (from SYNTHESE):** the corpus is adult L2 research, partly Duolingo-funded, with no
studies of children, L1 literacy, or struggling readers. Everything below is a *mechanics*
proposal justified by that literature — not literacy pedagogy.

Tags: **[eng]** = engineering mechanics, no pedagogy content · **[Angelika]** = needs her
sign-off · **§X** = the ROADMAP.md section the item would land in.

---

## What the corpus says to keep unchanged (no action)

The literature *supports* these shipped/planned decisions — recorded so they don't get relitigated:

- **FSRS with default/shared parameters, per skill_tag** — per-item difficulty fitting failed in
  production at Duolingo scale (+12 % retention after removing it). Do not fit per-tag decay.
  *(HLR 2016)*
- **No time pressure, lives, leaderboards, or student push notifications** — task load is the
  measured mechanism of collapse for fine discrimination in weak learners; notifications buy only
  ~2 % engagement-currency retention. *(Similar-Sounding Words 2016; Notification bandit 2020)*
- **The professional trainer loop** — apps win on rules, humans on interaction; top-down human
  correction is the predicted lever for entrenched errors. *(App-vs-classroom 2025; Hierarchical
  inference 2016)*
- **D6 weekly parent email as the retention channel, prioritized over D5 badges** — motivation
  decays within ~4 months even in paid adults, in app *and* classroom; badges don't address that.
  *(App-vs-classroom 2025; Receptive/productive 2024)*
- **LLM generation → schema validation → human review** — the validated generate-in-bulk pattern.
  *(ML-Driven Assessment 2020; STAPLE 2020)*
- **Deterministic weak/due-targeting sessions** — exactly the "progression locks" the
  app-vs-classroom authors recommend. *(App-vs-classroom 2025)*

---

## A. §F-bound — content-set redesign (act on these while §F is being designed; retrofitting later is expensive)

1. **Task-load tiers per skill_tag** **[Angelika]** — classify each §F exercise type on a
   recognition → cued production → free production ladder and make the tier a property of the
   type/taxonomy design; a skill graduates tiers, and mastery is never declared from
   recognition-level (multiple-choice) performance alone. **New hard contrasts enter at the lowest
   tier first** (choose between two spellings) before high-load tasks (dictation).
   *Why:* "leveling up" through progressively harder formats is the causally best-validated
   activity in the corpus, and it yields graded difficulty with **no IRT/calibration at all**;
   minimal-pair learning measurably collapses when introduced under full task load, especially
   for the weakest learners. *(Assessment at Scale 2021; Similar-Sounding Words 2016)*
2. **Distractor discipline + confusion-pair rule for generation and authoring** **[Angelika]** —
   in `LLM_SYSTEM` (§F6) and the German authoring guide (`content/README.md`): distractors must
   differ from the target **only on the dimension the skill_tag names** (plausible-but-wrong, no
   absurd fillers, answer not guessable from word frequency); prefer items that contrast a due
   skill with its natural confusion partner (das/dass, ie/i, ss/ß, Dehnungs-h vs none…), and let
   LLM lectures frame the confusable *pair* rather than "your weakest skill".
   *Why:* items passable via surface cues measure nothing and poison telemetry; learners learn
   best from two-alternative contrasts. *(Entity Representations 2020; Self-Directed Learning
   2015; Learning from omission 2019)*
3. **Frequency-anchored carrier words** **[Angelika]** — introduce each rule through a small set
   of high-frequency words from German child vocabulary (childLex as candidate source) before
   broadening to rarer material; consider a word-frequency layer in bank item selection.
   *Why:* knowledge grows around frequent "pathbreaking" exemplars before generalizing.
   *(Constructional Knowledge 2019; Word skipping 2019)*
4. **Log generation-time item features on `item_bank`** **[eng]** — additive columns/JSON at
   import & generation time: word-frequency band, word length, syllable count, grapheme
   complexity/irregularity, (later a wordlikeness score). No consumer yet — this is data
   insurance.
   *Why:* a feature-based difficulty model reaches near-optimal from ~500 sessions, but only if
   the features exist; they cannot be reconstructed retroactively for superseded item versions.
   *(Jump-Starting 2021; ML-Driven Assessment 2020)*
5. **Session composition: forward + review, not review-only** **[eng]** + **[Angelika]** for the
   ratio — bank sessions should mix forward movement (new/next-unit content) with weak/due
   review instead of drilling weak tags exclusively.
   *Why:* in the one 6-month ecological study, re-reviewing completed material had ~zero
   relationship with gains while completing new lessons predicted them; success-rich practice
   (~90 % session accuracy) predicted proficiency gains. *(Frequency/duration/intensity 2023;
   Receptive/productive 2024)*
6. **Held-out `assessment_only` item pool per skill** **[eng]** mechanics, **[Angelika]** item
   choice — a small pool flagged assessment-only: never used in ordinary practice, shown
   occasionally, single attempt, no retry, calm/no-feedback presentation; the trustworthy basis
   for progress claims (trainer views, parent email, §J analytics).
   *Why:* today practice items double as measurement items; retries and feedback are good
   pedagogy but contaminate measurement. *(Assessment at Scale 2021)*
7. **Remediation escalation path** **[Angelika]** design, **[eng]** trigger — a skill that stays
   wrong across N FSRS reviews stops being merely rescheduled and instead: drops to a lower
   task-load tier, gets exaggerated-contrast items with varied irrelevant surface features, and
   is flagged to the trainer.
   *Why:* entrenched wrong generalizations are predicted (and observed) to asymptote under plain
   repetition; disconfirming, contrast-exaggerated input is the mechanism that works. The
   trainer's explicit "these two look alike but differ" is the highest-leverage form.
   *(Hierarchical Inference 2016; Mixture Modeling 2015)*

## B. §J-bound — telemetry & analytics

1. **Sharpen J5.1 (robust `time_ms`)** **[eng]** — beyond the planned visibility-pause +
   winsorize: aggregate with **median or log-mean, never raw mean** (RT is heavily right-skewed),
   and keep per-window **variance** alongside the central value.
   *(Mining Process Data 2021; Eye-Movement Targets 2020)*
2. **Degenerate-response / fast-guessing detector** **[eng]** — from existing fields only
   (`time_ms`, `attempt_no`, correctness, over rolling windows of items, not single items):
   detect (a) fast + low-variance + wrong ≈ clicking through, and (b) chance-level responding on
   a skill. Effect: suppress the affected attempts from FSRS scheduling and from the digest
   (else the LLM writes lectures about skills the student never truly attempted), and surface a
   calm advisory flag to the trainer — never an automatic consequence.
   *Why:* the >15 s heuristic is blind to disengaged guessing (a guessing child looks *strong*
   to it), and "stuck at chance" clusters are often artifacts (accessibility, unreadable prompt),
   not learning failures. *(Mining Process Data 2021; Mixture Modeling 2015; Similar-Sounding
   Words 2016)*
3. **First-session down-weighting** **[eng]** — exclude or down-weight each student's first
   session before it reaches FSRS and the digest (familiarization noise).
   *(SLA Modeling 2018)*
4. **J2 additions** **[eng]** — when the content-analytics read model lands: per-item
   **wrong-answer distributions** (from existing `attempt.given`) → per-student and per-item
   confusion matrices (feeds A.2 distractor/contrast selection and trainer diagnostics), and
   **2–3-cluster learning curves per skill** (already-mastered / learning / stuck-at-chance)
   instead of one aggregate curve.
   *(STAPLE 2020; Self-Directed Learning 2015; Mixture Modeling 2015)*
5. **Scheduler calibration check** **[eng]** — a periodic report of predicted vs observed recall
   per skill_tag (MAE-style), so a "this skill decays too fast forever" pathology is detectable
   without waiting for complaints. Optionally keep a small random-selection slice in bank
   sessions as a permanent baseline for the adaptive layer.
   *(HLR 2016; Notification bandit 2020)*
6. **Partial credit in analytics** **[eng]** — record/derive an edit-distance-style closeness for
   typed spelling answers (analytics + digest only; the student-facing UX stays binary and calm).
   *Why:* near-miss vs chaos is real signal that binary scoring discards. *(ML-Driven Assessment
   2020)*

## C. §D-bound — engagement surfaces

1. **D6 parent email content rules** **[eng]** — report **sessions/lectures completed, never
   minutes** (minutes predicted nothing); objective per-skill data, not feelings (self-assessment
   is systematically wrong); **rotate framing templates** with a ~2-email cooldown (repeating the
   last template measured *worse than random*); frame over-generalization errors as progress
   ("wendet die Regel schon an, übt noch die Grenze"). *(Frequency/duration/intensity 2023;
   App-vs-classroom 2025; Notification bandit 2020; Constructional Knowledge 2019)*
2. **D8 / TTS** **[eng]** — interim one-liner: lower Web Speech `utterance.rate` for exercise
   audio now. When Polly lands: clear-speech parameters (markedly slower rate, wider pitch
   range, longer word duration) — slow-and-clear, never a condescending register.
   *Why:* semantic context gives **zero** help when audio is poor — audio quality is pedagogical,
   not cosmetic, and the cost falls on exactly the weakest users. *(Word recognition in noise
   2019)*

## D. Chat (★) — prompt-level guardrails

1. **Anti-crutch rule** **[eng]** prompt change, **[Angelika]** wording — the chat may hint,
   segment the word, name the strategy (Silbenschwingen, Verlängern, Ableiten), and explain the
   rule — but **never supply the target spelling** the student is working on; feedback highlights
   what the student got right before addressing the error.
   *Why:* the named GenAI harm is crutch use; the named mitigation is "learner still assembles
   the response"; success-highlighting + explicit strategy teaching were the active ingredients
   behind the self-efficacy gains. Dose doesn't matter — no engagement-optimization needed.
   *(GenAI self-efficacy 2025)*

---

## Suggested adoption order (leverage ÷ cost)

1. **A.4** feature logging (data insurance — cheap now, impossible later) · **C.2** interim
   `utterance.rate` (one line) · **D.1** chat guardrail (prompt edit).
2. **A.1–A.3** into the §F type/taxonomy design *while it is being drafted* with Angelika —
   these shape the taxonomy and `LLM_SYSTEM`, and retrofitting tiers/contrast-structure after §F
   ships would mean reworking the type union.
3. **C.1** when D6 is built (it's a spec note, not extra work).
4. **B.1–B.3** with the already-planned J5 work · **A.5, A.6** as §F session/selection logic
   lands.
5. **B.4–B.6, A.7** once real content produces telemetry (post-§F, with J2/J3).
