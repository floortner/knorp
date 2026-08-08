# Ongoing Cognitive Processing Influences Precise Eye-Movement Targets in Reading

*Source PDF: [`pdf/bicknell.ps20.pdf`](pdf/bicknell.ps20.pdf)*

Klinton Bicknell (Duolingo AI Research, Pittsburgh, PA; Northwestern University), Roger Levy (Department of Brain & Cognitive Sciences, MIT), and Keith Rayner (Department of Psychology, UC San Diego).

*Psychological Science*, 2020, Vol. 31(4), 351–362. © The Author(s) 2020. DOI: 10.1177/0956797620901766.

> **Note:** This file is a structured, detailed summary/paraphrase of the paper rather than a verbatim transcription — written to preserve all substantive content (design, method, results, and conclusions) for later processing, without copying the publisher's text directly.

## Keywords

Reading, eye movements, psycholinguistics, motor control, open data, open materials.

## Abstract (paraphrased)

Reading requires readers to move their eyes 3–4 times per second, deciding on each saccade exactly which part of the next word to target. The standard view in the field is that this fine-grained targeting decision is governed purely by low-level oculomotor heuristics (word length, launch site) and is *not* sensitive to how much of the word's identity a reader has already processed. This paper argues against that view: using a covert text-shifting (boundary/display-change) paradigm, the authors show a genuine statistical relationship between within-word saccade-target position and trial-to-trial variability in how much of the upcoming word had already been cognitively processed before the saccade landed. The result suggests the brain optimizes eye-movement control in reading down to the level of exact character-position targeting, reflecting an efficiency-driven sensitivity to ongoing cognitive processing — not merely a fixed, non-adaptive heuristic.

## 1. Background

Reading is a highly practiced, culturally recent skill (written language: ~4,000 years old; widespread literacy: only the last few centuries), too recent for dedicated evolutionary specialization, yet skilled readers develop specialized neural machinery for it (citing Dehaene & Cohen, 2011). Other domains of complex motor control (e.g., sensorimotor integration, Kording & Wolpert, 2004; visual search, Najemnik & Geisler, 2005; motor coordination, Todorov & Jordan, 2002) show near-optimal, tightly cognition-linked motor control, raising the question of how optimized reading's motor control is.

The consensus view distinguishes:
- **When** to saccade and **which word** to target next — both known to be sensitive to ongoing cognitive/linguistic processing.
- **Where exactly within the targeted word** to land (called here **saccade targeting**) — traditionally believed to be efficient only at a *coarse* level (word length, distance from current fixation), governed by a fast heuristic, and *insensitive* to how much of the word's identity has already been processed.

This paper tests and rejects that traditional "fast-heuristic" account of saccade targeting, and supports an alternative "cognitive-processing" account.

### 1.1 The fast-heuristic account

- The **functional target** of a saccade is always the center of the word (from single-word-recognition research).
- **Systematic error** biases the actual saccade length toward a preferred saccade size (~7 characters), computed as a weighted average of intended saccade length and the preferred size — yielding the **actual target**.
- This purely reflects word length and launch site, with **no sensitivity to cognitive processing**.
- The model successfully explains the well-known landing-site distribution facts: for a fixed launch site, landing sites are unimodal (truncated-normal), and the mode shifts forward as launch site moves forward (systematic error).
- The model is attractive partly because saccade-target selection may need to complete before the new word's identity has been substantially processed, and because it computes targets purely from word length/spatial extent — which works even for writing systems without inter-word spaces, given a length estimate.

### 1.2 The cognitive-processing account (alternative)

- Readers often begin identifying an upcoming word *while still fixating the previous word* (parafoveal preview), typically limited to the word's first few letters due to declining visual acuity and *visual crowding* away from the fovea.
- Under this account, saccades target the **most useful position for further identification given the reader's current processing state** — i.e., readers who have already identified more of a word's initial letters should target their saccade *farther forward* into the word (closer to the still-unprocessed remainder), since that is where the fovea would gain the most new information.
- This account also reproduces the aggregate landing-site facts: farther-forward launch sites correlate with higher-quality parafoveal information about the word's start, so the model predicts landing sites shift forward with launch site — matching the empirical pattern.

### 1.3 The critical distinguishing prediction

Both accounts fit the *aggregate* landing-site distribution equally well, but they diverge on **trial-to-trial variability**. In all major models of reading, there is genuine trial-to-trial variability in how much of an upcoming word a reader processes before fixating it, even holding launch site fixed.

- **Fast-heuristic account**: targeting depends only on launch site and word length — so trial-to-trial variability in pre-fixation processing should be **unrelated** to trial-to-trial variability in where the saccade actually lands.
- **Cognitive-processing account**: targeting is sensitive to processing state — so trials in which readers had already identified *more* of the word before fixating on it should show saccades landing **farther forward** in the word.

The paper's goal: directly test for this predicted relationship between (a) how much processing a reader has done of an upcoming word prior to fixating on it and (b) exactly where within the word the saccade lands.

### 1.4 Why a naive comparison doesn't work

One might try comparing word-identification time as a function of landing position directly, but fixation position within a word has large, well-documented effects on word-identification measures on its own (both in standard eye-movement studies, Vitu, O'Regan, & Mittau, 1990, and in isolated visual word-recognition studies under full experimental control of fixation position, O'Regan et al., 1984). This confound makes a simple correlational comparison uninterpretable.

**Solution:** the authors instead use a **gaze-contingent display-change paradigm** to shift the on-screen text *during* a saccade — invisible to the reader due to visual saccadic suppression — which experimentally **dissociates** the saccade's *original destination* (what the eyes were actually aimed at, before the display change) from its *actual landing site* (where the eyes ended up after the display shifted). This lets the researchers hold actual landing site constant while comparing different original destinations (which reflect different underlying processing states), isolating the causal question of interest.

## 2. Method

### 2.1 Design overview

Readers' eye movements were tracked while they read individual sentences in fixed-width font. Each sentence contained a **seven-letter target word**, immediately preceded by a three- or four-letter noun (the "pretarget word"; full materials at https://osf.io/kgmpy).

When the reader's eyes crossed an invisible boundary immediately before the space preceding the target word (the boundary technique), the display was updated with one of three outcomes:
1. **No shift** — no change; the eyes land on the original destination.
2. **Text-right shift** — text shifted 3 characters to the right, so the eyes land 3 characters *farther back* than originally aimed.
3. **Text-left shift** — text shifted 3 characters to the left, so the eyes land 3 characters *farther forward* than originally aimed.

Seven possible **original destinations** were defined, one per letter of the 7-letter target word (numbered 1–7). Because the shift moves the landing point by exactly 3 characters, this design lets the researchers compare saccade populations with *different original destinations* landing at the *same actual position*. For example: an Original Destination of 2 under a text-left shift lands at the same actual position (Letter 5) as an Original Destination of 5 under no shift. Similarly, Original Destination 5 under a text-right shift lands at the same actual position as Original Destination 2 under no shift, at Letter 2.

The full comparison design crossed:
- **4 destination-pair comparisons**: (1 vs. 4), (2 vs. 5), (3 vs. 6), (4 vs. 7) — each pair differing by exactly 3 letters ("farther behind" = the smaller-numbered original destination; "farther forward" = the larger-numbered one)
- **2 actual landing sites** per comparison
- for a nominal 4 × 2 × 2 factorial structure (though 2 of the 16 cells were identical because Original Destination 4 appears in two comparisons at the same actual landing site — see Note 2 below).

**Key prediction under the cognitive-processing account:** within each comparison, holding actual landing site fixed, the population whose original destination was *farther forward* into the word should show *less* subsequent word processing (because they had already processed more of the word to justify that farther-forward aim), while the *farther-behind* population should show *more* subsequent processing.

**Key prediction under the fast-heuristic account:** no such effect of original destination should appear once launch site and actual landing site are both held constant.

### 2.2 Participants and materials

Three experiments were run, differing only in which display-change conditions were included:
- **Experiment 1**: 40 UC San Diego participants; only no-shift and text-right-shift conditions (no text-left-shift). Sample size chosen based on the researchers' experience with this kind of study.
- **Experiment 2**: 40 additional participants; all three conditions (no-shift, text-right, text-left), added to resolve the theoretical ambiguity left by Experiment 1's missing text-left condition. Sample size matched to Experiment 1.
- **Experiment 3**: 40 additional participants; identical design to Experiment 2, but with a faster display-change implementation (display changes completed sooner relative to the triggering saccade), motivated purely by a software/timing improvement.

Data were collapsed across the three experiments for the primary ("collapsed") analysis reported here (120 participants total); the paper notes that per-experiment analyses (in Supplemental Material) were highly consistent with the collapsed analysis.

Each experiment used 160 sentences, each containing a 7-letter verb as the target word, immediately preceded by a 3- or 4-letter noun (the pretarget word). 160 was chosen as roughly the largest number reliably readable in one ~1-hour session, to maximize statistical power. Sentences were shown one line at a time in 14-point Courier New (fixed-width) font, and condition assignment to items was counterbalanced and randomized per participant. A comprehension question followed a random 56 of the 160 trials to encourage attentive reading, with breaks offered halfway through and available on request.

### 2.3 Apparatus

Eye movements were tracked with an SR Research EyeLink 1000 eye tracker at 1,000 Hz, binocular head positioning via a chin rest, monocular (right-eye) recording. Sentences were displayed on an HP p1230 20-inch CRT monitor (150 Hz refresh, 1,024×768 resolution) at 60 cm viewing distance (1° visual angle ≈ 2.4 characters).

### 2.4 Data-cleaning / exclusion procedure

- Fixations shorter than 80 ms within a single character width (11 px) of an adjacent fixation were merged into that adjacent fixation.
- Fixations shorter than 80 ms that were *not* merged were removed.
- Trials were excluded if they contained: a fixation longer than 1,000 ms; track loss (e.g., a blink) on, immediately preceding, or following the target-word region; or a display change completed more than 9 ms after the start of the following fixation (to avoid trials where the change occurred mid-fixation and could disrupt reading).
- Participants were excluded and replaced if they had excessive data loss: more than 1/3 of trials excluded for track loss, or more than half excluded for late display changes. This left **120 clean participants** (40 per experiment) in the analyses, plus 26 excluded-and-replaced participants (16 for track loss, 10 for late display changes) across the three experiments. Among the 120 retained participants, 14% of trials were excluded for the reasons above.

### 2.5 Dependent measures and statistical models

Two measures of word processing were analyzed:
- **Gaze duration**: the summed duration of all fixations on the target-word region prior to leaving it, on the *first pass*.
- **Refixation probability**: the probability of making more than one fixation on the target-word region before leaving it.

**Gaze duration** was analyzed with linear mixed-effects regression; **refixation probability** with logistic mixed-effects regression. Both included a fixed effect of original destination plus random intercepts and random slopes (by-participant and by-item) for original destination. Control fixed effects for actual (postshift) landing site and launch site (as unordered categorical predictors) were included; launch sites with fewer than 20 observations (0.8% of trials) were excluded for data sparsity, and control-variable effects themselves are not reported (they're not the theoretical focus). Outlier gaze durations (>3 SD from a participant's mean) were excluded.

Two model parameterizations were fit for each dependent measure, both within the 4 (comparisons) × 2 (destination type: farther-behind/farther-forward) × 2 (actual landing site) design:
- **Main-effect model**: models a single overall effect of original destination, averaged across the 4 comparisons, plus 3 interaction terms allowing the effect to vary arbitrarily by comparison. Used to estimate the overall-average effect and its confidence interval (CI).
- **Independent model**: parameterizes the effect of original destination separately within each of the 4 comparisons (rather than as an overall average + interactions), used to get comparison-specific estimates. This model allows 4 terms for arbitrary differences between the two actual landing sites within each comparison, 6 terms for arbitrary differences between actual landing sites overall, and an effect of launch site.

*p* values were computed via likelihood-ratio tests comparing the full model against a reduced model omitting each fixed effect of interest. Full parameterization detail is in Supplemental Material Section S1. All raw data files and analysis scripts are openly available at https://osf.io/kgmpy.

## 3. Results

### 3.1 Overall analysis (all trials)

Across all 4 comparisons and both actual landing sites, the population whose original destination was **farther behind** consistently showed **longer gaze durations and higher refixation probabilities** on the target word than the population whose original destination was **farther forward** — exactly as predicted by the cognitive-processing account.

- **Overall effect, gaze duration**: an estimated 25 ms longer gaze duration for the farther-behind population (β̂ = 25 ms), highly statistically reliable, *p* <.001.
- **Overall effect, refixation probability**: β̂ = 0.6 logits, *p* <.001.
- Comparison-specific effects (from the independent-model parameterization) were reliable for gaze duration in all 4 comparisons except the 4-vs-7 pair (1 vs. 4: *p* <.001; 2 vs. 5: *p* <.01; 3 vs. 6: *p* <.001; 4 vs. 7: *p* =.18), and for refixation probability likewise reliable in 3 of 4 comparisons (1 vs. 4: *p* <.001; 2 vs. 5: *p* <.01; 3 vs. 6: *p* <.05; 4 vs. 7: *p* =.19).
- An omnibus interaction test found no statistical evidence that the effect of original destination differed across the 4 comparisons (all *p*s >.30), i.e., the effect looks broadly uniform across comparisons rather than driven by just one or two.

Numerically, the per-comparison coefficient estimates for gaze duration (overall average and per-pair) clustered around 20–30 ms with fairly wide but generally positive confidence intervals, and refixation-probability estimates clustered around 0.5–0.75 logits, again generally positive across comparisons.

### 3.2 Ruling out mislocated fixations

**Concern:** the interpretive logic above assumes every saccade landing on the target word was *intended* for the target word. But some saccades land on the target word only by motor error while actually being intended for a *different* word — either (a) intended for the *pretarget* word but overshot (further subdivided into cases where the pretarget word had not yet been fixated ["intended initial fixations"] vs. had already been fixated ["intended refixations"]), or (b) intended to *skip over* the target word toward the posttarget word but undershot ("intended-skip" saccades). If the proportion of such mislocated fixations differs systematically between original-destination populations, that alone (rather than genuine cognitive-processing sensitivity) could explain the observed pattern — and this would be a legitimate account *within* the fast-heuristic framework, since fast-heuristic saccades always move toward word centers.

**Subset analysis (ruling out pretarget-intended mislocations):** Under the fast-heuristic account, intended fixations/refixations of the pretarget word always move the eyes *toward* that word's center — so restricting the analysis to trials where the saccade to the target word was preceded by a single fixation on the *right half* of the pretarget word eliminates the possibility that the saccade was actually a leftward-intended movement mislabeled as landing on the target word. This subset represents 49% of the full dataset.

Results within this subset were **highly similar** to the full-dataset results: the farther-behind original destination again showed longer gaze durations and higher refixation probabilities for every actual-landing-site-controlled comparison. The overall effect was again statistically reliable for gaze duration (β̂ = 34 ms, *p* <.001) and refixation probability (β̂ = 0.8 logits, *p* <.001); again no evidence the effect differed across the 4 comparisons (*p*s >.4). Comparison-specific reliability for gaze duration: 1 vs. 4, *p* =.34 (not reliable in this subset); 2 vs. 5, *p* <.001; 3 vs. 6, *p* <.001; 4 vs. 7, *p* <.01. For refixation rate: 1 vs. 4, *p* <.05; 2 vs. 5, *p* <.001; 3 vs. 6, *p* =.087; 4 vs. 7, *p* <.05. The authors conclude this represents strong evidence that the overall results cannot be explained by mislocated fixations intended for the pretarget word.

**Mixture-of-Gaussians modeling (addressing intended-skip mislocations):** The remaining possibility under the fast-heuristic account is that the set of saccades landing on the target word is a *mixture* of two populations: one genuinely intended for the target word, and one intended to skip past it to the posttarget word but undershooting ("intended-skip" saccades). If the mixing proportion of intended-skip saccades differs by original destination (with intended-skip saccades presumably reflecting *more* prior processing of the target word — enough to justify trying to skip it — hence potentially shorter subsequent processing), that alone could reproduce the observed pattern under a purely fast-heuristic mechanism.

To evaluate this, the authors fit maximum-likelihood **mixture-of-two-Gaussians models** to the empirical distribution of forward-saccade landing positions from each of the two launch sites used (2 or 3 characters before the critical word — the two possible lengths of the pretarget word), separately for each launch site (since fast-heuristic targeting parameters are a function of launch site). One Gaussian component represents saccades genuinely intended for the target word; the other represents intended-skip saccades landing short. From the fitted mixtures, the researchers computed the estimated proportion of intended-skip saccades for each of the 7 possible original destinations (Fig. 7, right column; alternative mixture-model specifications, all yielding qualitatively similar conclusions, are reported in Supplemental Material Section S2).

**Finding:** the fast-heuristic-plus-mixture account *could* potentially explain the observed differences for the **3-vs-6** and **4-vs-7** comparisons, because the estimated proportion of intended-skip saccades was substantially higher for the farther-forward original destinations in those two pairs. **Crucially, however, this was not the case for the 1-vs-4 and 2-vs-5 comparisons** — the estimated intended-skip proportion was lower (not higher, or virtually equal, within 1 percentage point) for the farther-forward destination than the farther-behind one in those two pairs, meaning the mixture account cannot explain those results. The authors conclude that even under the most generous allowance for mislocated fixations, the fast-heuristic account **cannot account for the full pattern of results**.

## 4. Discussion

### 4.1 Summary of the core finding

The data provide strong evidence against the fast-heuristic account, under which all saccades from a given launch site toward a word are aimed at the same position regardless of processing state. Instead, the authors found reliable differences in subsequent eye-movement behavior (gaze duration, refixation probability) between saccades that *would have* landed at different positions within a word (different original destinations), even while holding the *actual* landing position constant and controlling for launch site. This held even after accounting for the possibility that some saccades were intended for another word entirely (either the pretarget or posttarget word).

The key result — saccades directed farther forward in the target word are associated with *less* subsequent target-word processing after landing — is exactly what the cognitive-processing account predicts: readers who have already identified more of a word's initial letters preferentially direct their eyes farther forward in the word (since that maximizes new information gained), and having identified more, need less additional processing time upon fixating.

### 4.2 Implications for the fast-heuristic vs. cognitive-processing debate

The fast-heuristic account naturally explains the *relationship between launch site and modal landing position*, but leaves the *role of cognitive processing in fine-grained targeting* unspecified. The findings here don't rule out that fast heuristics play *some* role generally in saccade targeting, but they do show that in at least a subset of trials, cognitive processing modulates saccade targeting at a fine, within-word grain. A more radical possibility, consistent with the data, is that saccade targeting in reading is *always* determined by cognitive processing, and heuristics play a limited or nonexistent role.

The authors note that although the fast-heuristic account is remarkably successful at capturing the bulk of variance in aggregate saccade-targeting statistics (which might suggest preferring it), prior work has shown that cognitive-processing accounts can also fit that same aggregate data. Given that both accounts fit the aggregate data, but only the cognitive-processing account explains the trial-to-trial relationship demonstrated here, the authors suggest a **parsimony**-based preference for the cognitive-processing account. They further note that the fast-heuristic account is already known to fail to fit reading data from writing systems without inter-word spaces, such as Chinese — a further point against a purely heuristic, spatially-based account, and toward a model of saccade targeting that generalizes across languages/scripts via cognitive-processing optimization rather than word-length-based heuristics.

The cognitive-processing account, in the authors' view, naturally accounts for the specific relationship demonstrated here between saccade targeting and subsequent eye-movement behavior — a relationship the fast-heuristic account is structurally unable to explain, even with generous allowances for mislocated fixations. Future work disentangling exactly how much residual role fast heuristics might play (versus a fully cognitive-processing-driven account) would likely require quantitative computational comparisons between both classes of models.

### 4.3 Broader theoretical framing

The paper situates its results within a broader view of eye-movement decisions in reading as reflecting **goal-based optimization** (citing Bicknell & Levy, 2010), extending prior evidence for near-optimal control in other motor domains (sensorimotor integration, visual search, general motor coordination — see Section 1) to the specific, fine-grained decision of *exactly where* within a word to land a saccade — previously thought to be the one saccade-targeting decision insensitive to cognitive state.

The authors also connect the finding to classic results in other areas of language processing where fine details of incremental cognitive state are known to rapidly influence behavior:
- **Shadowing** (real-time repetition of heard speech): disrupted words are spontaneously restored to their correct forms even under short (~250 ms) latency, in syntactically/semantically supportive contexts — e.g., "tomorrane" repeated back as "tomorrow."
- **Visual-world paradigm** (eye movements to named objects in a scene): listeners often begin programming a saccade to the referenced object before the auditory word is even finished.

By analogy, the present within-word saccade-targeting results show that reading, too, is guided by ongoing cognitive processing of the very word being targeted, even before its identity is fully resolved.

### 4.4 Suggested extensions to other domains

Given the present results for reading, the authors suggest that ongoing cognitive processing might similarly play a role in other fine-grained saccade-targeting decisions outside of reading, such as:
- **Face processing**
- **Scene viewing**

They suggest that the experimental method and analytical logic developed here (dissociating original destination from actual landing site via covert display shifts, then comparing subsequent processing across matched actual landing sites) could be adapted to study oculomotor control in these and other settings.

## Transparency / Author information

- **Action Editor:** Rebecca Treiman. **Editor:** D. Stephen Lindsay.
- **Author contributions:** K. Bicknell, R. Levy, and K. Rayner designed and performed the research and analyzed the data. K. Bicknell and R. Levy wrote the manuscript. All authors approved the final manuscript for submission.
- **Conflicts of interest:** None declared.
- **Funding:** National Science Foundation Grants 0953870, 1734217, and 1815529; National Institutes of Health Grants T32-DC000041, T32-DC000035, and R01-HD065829.
- **Open Practices:** All data, analysis scripts, and materials are publicly available via the Open Science Framework at https://osf.io/kgmpy (design and analysis plans were not preregistered). The article received Open Data and Open Materials badges.
- **ORCID:** Klinton Bicknell — https://orcid.org/0000-0003-3404-7432
- **Acknowledgments:** The article is dedicated to the memory of K. Rayner (one of the co-authors, who passed away — the paper thanks him posthumously alongside the living authors' acknowledgments). The authors thank Emily Higgins for assistance with all aspects of the project; Araceli Cervantes, Georgina Chen, Tiffany Lai, Hannah Johansen, and Vinny Uy for assistance with data collection and stimuli development; and audiences at the 2012 Annual Meeting of the Psychonomic Society, the 2013 Annual Meeting of the Cognitive Science Society, and the 2014 Chinese International Conference on Eye Movements, for feedback.

## Notes (from the original article)

1. For writing systems without inter-word spaces, a reader would have to make an educated guess about word length to use a length-based targeting strategy.
2. The design is not quite a standard 4×2×2 factorial because 2 of the 16 cells were identical: the population with the farther-forward original destination in the 1-vs-4 comparison, assessed at Actual Landing Site 4, is the *same* population as that with the farther-behind original destination in the 4-vs-7 comparison, assessed at the same Actual Landing Site 4. The statistical model specification (detailed in Supplemental Material) accounts for this while retaining factorial-design-like interpretability.
3. Before trials with late display changes were excluded, the median display change completed 9 ms before the start of the next fixation in Experiment 3, compared with 3 ms after the start of the next fixation in Experiments 1–2. The speedup was achieved by setting the `display_type` parameter in the UMass EyeTrack software to "LCD."
4. Because the target word moved to different absolute screen positions depending on shift condition, blink-exclusion used a target-word region defined as the union of the locations occupied by the target word across all shift conditions.
