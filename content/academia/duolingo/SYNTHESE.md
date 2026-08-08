# SYNTHESE — the Duolingo research corpus vs. besserlesenschreiben

**What this is:** the evidence base behind `content/academia/DUOLINGO_ROADMAP.md`. All 23 paper
summaries in this directory were read in full (2026-08-08) and compared against the app's shipped
feature set and `ROADMAP.md`. Per paper: relevance verdict, the findings as the summaries state
them, and what they imply for this app. Engineering-facing, English on purpose (not part of
Angelika's German content workflow; nothing here is imported by the app).

**The hard caveat, first:** not one paper in this corpus studies children, L1 literacy, struggling
readers, or dyslexia. The populations are overwhelmingly adult L2 learners (one study's mean age
is 45); several studies are Duolingo-funded or Duolingo-authored; the efficacy and GenAI studies
have no control groups and 19–40 % attrition; reported effect sizes are small to medium. These
findings inform **product mechanics** (scheduling, telemetry, item structure, messaging). They are
not evidence about remedial German literacy pedagogy — that authority stays with Angelika, and
every pedagogy-touching proposal derived from this corpus requires her sign-off.

---

## Overall verdict

**The app's architecture is scientifically sound.** The corpus validates the spine — spaced
repetition per skill with shared parameters, telemetry-driven adaptive selection, a
human-in-the-loop over LLM output, calm no-pressure design, retention routed through the parent —
and several of the app's deliberate *restraints* turn out to be exactly what the production
literature recommends. The gaps it exposes are in telemetry interpretation and item/sequence
design; all of them are §F/§J-shaped, and none require re-architecture.

### Decisions the corpus directly supports (keep; don't relitigate)

1. **FSRS per skill_tag with default/shared parameters.** The 2016 HLR paper is FSRS's direct
   ancestor; its production lesson is that *per-item difficulty parameters overfit and had to be
   removed* (+12 % retention after removal). Not fitting per-tag decay at our data volume is
   correct, not a shortcut.
2. **No time pressure / lives / leaderboards.** The similar-sounding-words study shows fine
   discrimination collapses under concurrent task load, and the weakest learners drop to chance.
   Timers consume exactly the resource a struggling reader needs. This is hard evidence for the
   stance, not just values.
3. **The trainer loop is load-bearing.** Apps beat teachers on rule/receptive knowledge and lose
   on interactive skill (app-vs-classroom, 2025); entrenched wrong generalizations need top-down
   correction that repetition can't provide (hierarchical inference, 2016).
4. **D6 parent email is genuinely the highest-leverage open engagement item.** Motivation declined
   significantly over 16 weeks even in paid adult volunteers, in *both* app and classroom groups.
   Badges won't fix that; the parent channel plausibly can. Forgoing student push notifications
   costs ~2 % new-user retention in engagement currency (notification bandit, 2020) — small, known,
   acceptable.
5. **LLM generation + schema validation + human review** is the validated Duolingo pattern
   (generate in bulk, estimate/validate automatically, keep a human filter).
6. **Deterministic guided progression** equals the "progression locks" the app-vs-classroom
   authors explicitly recommend, and sidesteps the self-selection confound that forced Duolingo's
   assessment papers into regression-discontinuity designs.
7. **Chat as explain-my-answer targeting self-efficacy** — the right primary outcome for a
   learned-helplessness audience; usage dose showed no effect on the outcome, so the calm
   no-engagement-optimization design costs nothing.

### Gaps the corpus exposes (ranked by leverage/cost — detail in DUOLINGO_ROADMAP.md)

1. **Task-load/difficulty tiers per skill** (recognition → cued → free production) — graded
   difficulty via exercise *format*, no IRT needed; the causally best-validated activity in the
   corpus; hard contrasts must start low-load.
2. **The >15 s weak-skill heuristic is under-specified** — raw-mean RT is skew-dominated and the
   heuristic is blind to fast-guessing; needs median/log + variance + `attempt_no`, windowed, plus
   a degenerate-response detector.
3. **Review/forward balance** — re-drilling already-covered skills was the zero-gain activity
   category in the one 6-month ecological study; sessions should mix forward content with review.
4. **Confusion-pair selection + distractor discipline** — learners learn best from two-alternative
   contrasts; distractors must differ from the target only on the skill's dimension.
5. **Held-out assessment items** — practice items double as measurement items today; a small
   `assessment_only` pool makes progress claims trustworthy.
6. **Remediation escalation** — persistently failing skills need a different treatment, not a
   sooner due-date.
7. **Log item linguistic features at generation time** — enables a future feature-based difficulty
   model (~500 sessions suffice); impossible to reconstruct retroactively.

---

## Per-paper verdicts

### High relevance

#### A Trainable Spaced Repetition Model for Language Learning (2016) — HLR
- Half-life regression fits exponential forgetting; Leitner/Pimsleur are special cases with fixed
  weights. MAE 0.128 vs Leitner 0.235 on 12.9 M traces.
- **Per-item difficulty features backfired in production**: barely helped offline, then overfit
  (words decaying fast no matter how much practice, student complaints); removing them raised
  daily retention +12 % (p<.001, 3.3 M users) and fixed course cold-start.
- Recommends dense component features (frequency, length, POS) over sparse per-item parameters.
- **Implications:** FSRS with shared/global parameters is the mainstream, validated choice; never
  fit per-skill_tag decay at our volume. Derive the student/parent-facing strength display from
  the same model that schedules (Duolingo's meters diverging from the scheduler drove complaints).
  Add a calibration check (predicted vs observed recall per skill) so a "decays too fast forever"
  pathology is detectable without waiting for complaints. Caveat: outcomes were prediction accuracy
  and engagement — *not* learning gains; and the unit was an L2 vocabulary item (recall base rate
  .86), whereas ours is an orthographic rule. Exponential forgetting for L1 rule knowledge is an
  assumption, not a result.

#### Methods for Language Learning Assessment at Scale (2021)
- Learner achievement can't be measured from practice items alone (learner-controlled sequencing
  destroys experimental control); Duolingo injects dedicated assessment items — either a siloed
  quiz (calibrated, no feedback, single attempt) or items injected into random lesson positions.
- **"Leveling up" — the same content in progressively harder formats (recognition → recall →
  production) — causally dominates** every other activity type (regression-discontinuity design);
  the benefit transfers within a skill to unseen items.
- Making levels visible produced >10 % more lessons completed in A/B tests.
- **Implications:** the strongest single idea in the corpus for §F — a task-load ladder per skill
  gives graded difficulty *without* IRT, from exercise format alone. Also: keep a small held-out
  `assessment_only` item pool per skill (single attempt, no feedback, no retries) so progress
  measurement isn't contaminated by practice; retries are good pedagogy but bad measurement. Our
  guided progression sidesteps their central confound — an architectural advantage worth keeping.

#### Machine Learning–Driven Language Assessment (2020)
- Item difficulty predicted *a priori* from cheap linguistic features (char-n-gram likelihood,
  frequency, length) with no piloting; resulting test ranks examinees nearly identically to
  post-hoc IRT on 525 k response pairs (ρ=.96); reliability .96, r≈.74–.75 vs TOEFL/IELTS.
- Grading is probabilistic/partial-credit, which they argue extracts more information per item.
- **Implications:** "no difficulty model" is a fixable gap, not a necessary simplification —
  for German, childLex/SUBTLEX-DE frequencies, syllable counts, and grapheme complexity are
  off-the-shelf features. Partial credit (e.g. edit distance on spelling attempts) captures the
  difference between near-miss and chaos that binary correct/wrong discards — use in analytics
  first, UX never needs to change. Caveat: high-stakes adult proficiency ranking; no German-L1
  difficulty anchor exists in the paper (grade-level/Lehrplan anchoring would be our substitute).

#### Jump-Starting Item Parameters for Adaptive Language Tests (2021)
- Feature-based IRT (BERT-LLTM): near-optimal item parameters from ~500 exam sessions on a
  4,151-item bank (classic 2PL-IRT needs 200–400 responses *per item* and can't price unseen
  items at all). Explicit stance: items amalgamate several skills; one-parameter-per-item (and by
  extension one-tag-per-item) is the fragile assumption.
- **Implications:** removes the "too little data" excuse for difficulty modeling — a few hundred
  students cross the threshold in weeks. Directly relevant to LLM generation: every fresh item has
  zero response data forever; only a feature-based model can price it. Therefore: **log
  generation-time item features now** (frequency band, length, syllables, grapheme irregularity) —
  nearly free today, impossible to reconstruct later. A global per-student ability θ (which FSRS
  doesn't have) is what fixes cold-start on new skills — a strong reader shouldn't restart at zero
  per tag. Caveat: BERT-over-passages is the wrong featurizer for short orthographic items; use
  orthographic/phonological features.

#### Mixture Modeling of Individual Learning Curves (2015)
- Population learning curves hide everything: for one knowledge unit, ~2/3 of students were flat
  at ~5 % error (already knew it), 30 % genuinely improved, 3 % were stuck near chance — and the
  stuck cluster turned out to be an **accessibility artifact** (students skipping listen items:
  no speakers, hearing impairment), not a learning failure.
- Proposes stopping practice when expected marginal error reduction falls below threshold.
- **Implications:** never evaluate a skill_tag by one aggregate curve — expect three clusters
  (wasting-their-time / learning / stuck). Build a degenerate-telemetry detector: chance-level
  responding should be suppressed from FSRS and the digest and flagged to the trainer (else the
  LLM writes a lecture about a skill the student never actually attempted), not rescheduled
  harder. For struggling readers "always wrong" has many non-learning causes: can't read the
  prompt, guessing, sibling answering, broken item.

#### Self-Directed Learning Favors Local, Rather Than Global, Uncertainty (2015)
- Learners overwhelmingly sample items that pit the **two most confusable alternatives** against
  each other (label margin, 56 % of participants) over globally uncertain items, and
  margin-region sampling was associated with better learning (p<.05).
- **Implications:** German orthography is naturally pairwise — das/dass, ie/i, ss/ß, seit/seid,
  Dehnungs-h vs none, Auslaut b/p d/t g/k. Item selection for a due skill should prefer items
  contrasting it with the student's *specific* confusion partner rather than exercising it in
  isolation; LLM lectures should frame the confusable *pair*, not "your weakest skill". Needs a
  per-student confusion matrix — `attempt.given` already records which-wrong, so the gap is
  aggregation, not capture. Caveat: 59 undergraduates, artificial stimuli, one hour; the mechanism
  (two-way contrasts are easier to integrate under cognitive constraint) plausibly applies *more*
  to children, but that is inference.

#### Difficulty in Learning Similar-Sounding Words (2016)
- Minimal-pair learning collapses under full task load even when discrimination ability is
  demonstrably intact (task × similarity dissociation; adults reproduce the infant pattern —
  a general property of learning, not a developmental stage). The weakest half of learners were
  at chance on hard contrasts and showed no benefit from perceptual abilities they possessed.
- Authors' explicit recommendation: introduce hard contrasts in low-load discrimination tasks
  first, or embedded among otherwise-easy material; minimal-pair mapping tasks can make the
  underlying discrimination *worse*.
- **Implications:** the productive tension with the margin-sampling paper resolves into a
  sequencing rule — **contrast items yes, but introduce each hard contrast at low task load
  first** (choose between two spellings) before high load (write from dictation). Recognition ≠
  production: never mark a skill mastered from multiple-choice alone. This paper is also the
  strongest evidence-backed defense of the no-time-pressure stance: load is the mechanism of
  collapse. And it warns that drilling the hardest contrasts at the weakest students produces
  chance-level noise — detect and change the task instead of rescheduling.

#### Mobile language app learners' self-efficacy increases after using generative AI (2025)
- GPT-4 "Explain My Answer" + Roleplay: 6/7 self-efficacy items rose in the free-access cohort
  (1/7 in existing subscribers — novelty effect acknowledged); **usage dose predicted nothing**;
  named active ingredients: feedback that highlights success + explicit strategy teaching; named
  harm: crutch use, mitigated by designs where the learner still assembles the response.
- **Implications:** closest paper to our chat + LLM-lecture pair, and self-efficacy is arguably
  the right primary outcome for this audience (learned helplessness is the presenting problem).
  Concrete rules for the chat/lecture prompts: highlight success explicitly; *name the strategy*
  (Silbenschwingen, Verlängern, Ableiten); **never supply the target spelling** — hint, segment,
  explain (anti-crutch guardrail). Consider a short kid-friendly confidence instrument as an
  outcome measure. Caveat: uncontrolled, self-report, adults, Duolingo-authored; treat as design
  rationale, not efficacy evidence.

### Medium relevance

#### The effects of frequency, duration, and intensity on L2 learning (2023)
- Six months, 287 adults: **total minutes was the weakest predictor of gains** (r=.01 oral,
  n.s. in regression). Completed lessons and level-reviews (forward movement + consolidation)
  were the dependable correlates; **"skill practice" — re-reviewing already-completed material —
  had ~zero relationship with gains** (r=−.06/.08). Models explain only 4–6 % of variance.
- **Implications:** the sharpest push-back against a weak/due-only bank diet — balance review
  against forward progression into new content; a student who is only ever re-drilled on weak
  tags is in the measured zero-yield regime. Report sessions/lessons completed, never minutes
  (GoalCard, parent email). Caveat: correlational, adults, floor effects acknowledged by authors.

#### Second Language Acquisition Modeling (2018)
- Shared task, 7.1 M words: **response time was the best-supported engineered feature** (+.028
  AUC, the only one clearly significant); per-user variance (±.086) dwarfs every algorithm and
  feature effect; dropping each user's *first day* of data improved predictions; auto-derived
  linguistic features (POS, morphology) actively *hurt* (parser noise); model-class gains need
  millions of tokens.
- **Implications:** actually *use* `time_ms` as a signal, not just a log field; per-student
  adaptation beats per-item cleverness (converges with HLR's lesson); down-weight each student's
  first session (familiarization noise) before it reaches FSRS/digest; hand-curated skill_tags
  are safer than auto-tagged linguistic features; FSRS + simple rules is right at our scale —
  don't chase model complexity.

#### The effectiveness of Duolingo — receptive and productive (2024)
- 48 adults, 12 weeks: sessions-completed and session-accuracy (mean 93 %) predicted gains;
  weekly time predicted nothing; of the survey factors only *enjoyment* predicted outcomes; top
  user complaint: repetitiveness.
- **Implications:** count sessions, not minutes; the observed high-success regime (~90 %+
  accuracy) is a plausible calibration target for bank difficulty — gains came from success-rich
  practice, not struggle (especially apt for a remedial audience); item-surface variety per skill
  matters; the mascot/enjoyment layer is a mechanism, not decoration. Caveat: n=48, no control,
  paid, Duolingo-funded.

#### The effectiveness of app-based and classroom-based instruction (2025)
- 337 adults (M=45), 16 weeks, time-controlled: app beat classroom on grammar/receptive
  vocabulary with *less* study time; classroom beat app on listening/interaction. Motivation
  declined significantly in **both** groups. Self-assessment was systematically wrong (60 % named
  the untrained skill as most improved). Authors recommend progression locks forcing coverage of
  under-trained task types.
- **Implications:** structural argument that the human trainer is load-bearing — the app carries
  rule/word-level knowledge, humans carry the interactive/expressive side. Our deterministic
  weak-skill targeting *is* their recommended progression lock, already with the frustration
  guard rails they ask for. Parent email must report objective per-skill data, never
  feelings-based self-report. Motivation decay is the expected baseline → D6 parent channel over
  D5 badges in leverage.

#### Learning Additional Languages as Hierarchical Probabilistic Inference (2016)
- Framework paper: errors are rational under an entrenched-but-wrong internal model; strong
  priors block learning from ordinary exposure (5 days of accent exposure → still intermediate);
  learning improves when input is *improbable under the old model* — exaggerated contrasts,
  massed disconfirming evidence, variability on irrelevant dimensions.
- **Implications:** reframes persistent misspellings as rational over-generalizations, not noise.
  A skill that stays wrong across many FSRS reviews will not be fixed by "schedule sooner" —
  it needs a **remediation escalation path**: drop to a lower task-load tier, exaggerate the
  contrast, vary irrelevant surface features, flag the trainer (whose explicit top-down "these
  two look alike but differ" is exactly the high-leverage intervention the framework predicts).
  Caveat: built on speech perception/L2 transfer; the orthography analogy is ours, not theirs.

#### Influence of speaking style adaptations … word recognition in noise (2019)
- Clear speech ≫ conversational in hard conditions; **semantic context provides zero benefit when
  the acoustic signal is poor** (context and clarity are complementary, not substitutable); clear
  speech can read as condescending when material is easy; slower rate + wider F0 range carry the
  benefit.
- **Implications:** the deferred-TTS shortcut has a real cost for exactly the weakest users
  (dictation items over a fast flat default voice are the measured failure condition). Cheap
  interim fix: lower Web Speech `utterance.rate`. When Polly lands: clear-speech parameters
  (roughly half conversational rate, wider pitch range), with a register that is slow-and-clear,
  never baby talk. Caveat: adult native listeners; child benefit "remains to be determined".

#### Mining Process Data to Detect Aberrant Test Takers (2021)
- Raw response times are strongly right-skewed (they log-transform); single variables can't
  separate behavior types; the archetype "short RT + low variance + no answer changes" =
  clicking through without attention; flags must stay advisory with human adjudication.
- **Implications:** the >15 s weak-skill heuristic inherits all three problems — mean over skewed
  RT, single-variable, and blind to the *opposite* failure mode: a disengaged child guessing in
  1.2 s looks *strong* to it. Combine time (median/log + variance) with `attempt_no` and
  correctness over windows of items, not single items; keep flags advisory (matches the trainer
  model). The cheating/security framing does not transfer.

### Low relevance (one usable idea each)

- **A Sleeping, Recovering Bandit … Notifications (2020):** the machinery needs ~10⁵ samples/arm —
  unusable and deliberately excluded by design (no student push). Two transfers: *repeating the
  last message template scored worse than random* → rotate parent-email framings with a ~2-email
  cooldown; and keep a small permanent random holdout in adaptive selection to detect when the
  adaptive layer stops beating naive. Prices the forgone notifications at ~2 % new-user retention.
- **Simultaneous Translation and Paraphrase (2020):** multi-reference grading is mostly moot for
  single-answer German orthography. Transfer: **learner-response frequency — especially of wrong
  answers — is a first-class data asset** (their most robust modeling gain) for distractor design
  and diagnostics; and LLM-authored accepted-answer sets need human review (their generated
  paraphrases were too noisy to ship) — mirrors our trainer-over-vision-draft pattern.
- **Observing the Emergence of Constructional Knowledge (2019):** acquisition grows around
  high-frequency "pathbreaking" exemplars before generalizing → introduce each rule via frequent
  carrier words (childLex) before broadening; over-generalization errors (Dehnungs-h applied too
  widely) signal *progress* (rule acquired, boundary not yet) — frame calmly in trainer/parent
  surfaces. Largest transfer gap in the set (L2 English written syntax).
- **A rational model of word skipping (2019):** frequency + length dominate sentence context as
  drivers of word-level reading behavior — mildly reinforces frequency/length as the primary
  difficulty features; skilled-adult eye movements otherwise don't transfer.
- **Ongoing Cognitive Processing … Eye-Movement Targets (2020):** aggregate averages were
  consistent with two very different accounts; only trial-to-trial variability distinguished them
  — echoes "use RT variance, not just the mean". Otherwise basic psycholinguistics.
- **Using LSTMs … Phonotactic Learning (2019):** authors disclaim human-acquisition conclusions;
  their small-data caveat actually *defends* our hand-specified skill taxonomy. Side idea: a
  char-level wordlikeness score over child-appropriate German as a validator for LLM-generated
  distractors/pseudowords.
- **Exploring Neural Entity Representations (2020):** probing-task lesson — models pass tests via
  correlated surface cues. Transfer: **distractors must differ from the target only on the
  dimension the skill_tag names**, or the item tests nothing and telemetry measures surface-cue
  use. Also: beware answers being systematically the more frequent word (frequency heuristic
  short-circuits the rule).
- **Learning from omission (2019):** NLP modeling; only echo — gains concentrate where distractors
  are close to the target; distractor choice is a design variable, not filler.
