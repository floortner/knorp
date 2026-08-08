# Self-Directed Learning Favors Local, Rather Than Global, Uncertainty

*Source PDF: [`pdf/markant.cogsci16.pdf`](pdf/markant.cogsci16.pdf)*

Douglas B. Markant (Center for Adaptive Rationality, Max Planck Institute for Human Development), Burr Settles (Duolingo, Inc.), and Todd M. Gureckis (Department of Psychology, New York University).

*Cognitive Science*, 1–21. Copyright © 2015 Cognitive Science Society, Inc. All rights reserved. ISSN: 0364-0213 print / 1551-6709 online. DOI: 10.1111/cogs.12220. Received 3 September 2013; revised 14 October 2014; accepted 24 October 2014.

> **Note:** This file is a structured, detailed summary/paraphrase of the paper rather than a verbatim transcription — written to preserve all substantive content (models, experimental design, results, and conclusions) for later processing, without copying the publisher's text directly.

## Keywords

Information sampling; Self-directed learning; Active learning; Machine learning.

## Abstract (paraphrased)

Collecting ("sampling") information expected to be useful is a powerful way to facilitate learning, but little is known about how people decide which information is worth sampling as learning proceeds. The paper describes several alternative models — inspired by "active learning" research in machine learning — of how people might decide whether a given piece of information is worth collecting, provides a theoretical analysis of when these models are empirically distinguishable, and reports a novel experiment exploiting that distinguishability. The model-based analysis of participants' information-gathering decisions shows that people prefer to select items that resolve uncertainty **between two possibilities at a time**, rather than items with high uncertainty across **all** relevant possibilities simultaneously. Rather than adhering to strictly normative (global-uncertainty) or strictly confirmatory conceptions of information search, people appear to prefer a **"local" sampling strategy**, possibly reflecting cognitive constraints on the information-gathering process.

## 1. Introduction

A cornerstone of many educational philosophies is that people learn more effectively when they direct their own learning. One key mechanism by which self-direction could influence learning is the ability to choose among different sources of information — a decision process the authors term **self-directed information sampling**. The canonical example: a doctor deciding which diagnostic test (e.g., MRI vs. blood test) to run on a patient, weighing which test's uncertain outcome is most likely to reveal the correct diagnosis, drawing on domain knowledge to assess the value of each potential new source of information.

Relative to how well economic decision-making under uncertainty is understood, much less is known about how people judge the usefulness of new *information sources* during learning to decide what to sample. This paper aims to advance that understanding.

### 1.1 Two views on human information sampling

Two largely contradictory theoretical positions dominate prior work:

- **Confirmatory sampling.** A large literature on hypothesis testing and reasoning suggests people prefer to sample information consistent with their *existing* beliefs, even when that information is not maximally useful for learning. A well-known instance is the **positive test strategy (PTS)**: observing instances that are positive examples of one's current hypothesis, without regard to how those observations relate to *alternative* hypotheses. This reflects a singular focus on one hypothesis at the expense of considering alternatives, generally yielding less-useful information for learning.
- **Normative sampling.** A separate line of work argues sampling decisions are consistent with normative principles that integrate across *all* candidate hypotheses to determine what information best adjudicates between them (see Nelson, 2005, for a review). This traces to "optimal experimental design" theory and has accounted for sampling behavior in domains including visual search, spatial search, causal-structure learning, and sequence learning. Different specific normative models within this family (e.g., *probability gain* vs. *information gain*) can predict different sampling decisions depending on task structure and learner goals, but they all share the principle of integrating across *all* possible hypotheses.

### 1.2 An intermediate position

The authors reframe confirmatory vs. normative sampling not as two opposing camps but as **two endpoints on a continuum**, representing how much information from multiple hypotheses contributes to a sampling decision. Confirmatory sampling reflects a single hypothesis controlling behavior; normative selection typically integrates all viable hypotheses. Where a person falls on this continuum may depend on their capacity to consider alternative hypotheses and their relationships to possible outcomes — a capacity plausibly limited in complex problems with many hypotheses. For instance, individual differences in working-memory capacity predict how many alternatives people can consider when judging the probability of a focal hypothesis, and hence how well their judgments match normative predictions. Understanding sampling decisions may thus require understanding the cognitive constraints that limit performance on a given task.

This framing raises two questions the paper addresses:

1. **Formalizing intermediate models** that use alternative hypotheses to a lesser degree than full normative integration requires — closely related to recent work on *approximate Bayesian inference*, which links sub-optimal learning/decision-making to an impoverished representation of the hypothesis space. Few attempts have formalized this specifically for human information sampling (though see Steyvers et al., 2003, for an analogous approach in causal learning). This paper proposes one such formalization, inspired by contemporary **active machine learning (AML)** research.
2. **When do such intermediate models actually apply?** It's unclear which task/environmental circumstances lead to sampling behavior better described by an intermediate model. For certain hypothesis-space structures, confirmatory sampling is itself consistent with normative goals, since there's no need to consider more than one alternative. Learners who correctly perceive this might show more or less confirmatory sampling depending on the problem space. Similarly, prior domain experience is associated with more normative sampling, e.g., with familiar materials or in social-information-gathering problems.

**The paper's central proposal:** intermediate strategies likely emerge in sufficiently *complex* problems, via a strategy of **decomposing** a complex problem into simpler components and reducing "**local**" sources of uncertainty. E.g., when several features jointly determine an outcome, a learner might hold one feature constant while varying another across samples — the classic "**control of variables**" strategy, essential to scientific reasoning, central to searching hypothesis spaces effectively and to "learning to learn" about complex concepts.

The paper directly tests the idea that people prefer **local sources of uncertainty** when sampling, using a category-learning paradigm in which participants control which training items to sample. In this kind of problem, uncertainty about how to classify an item is directly related to how informative it is about the true category rule — raising the possibility that people rely on their subjective uncertainty about predicting query outcomes to decide between candidate samples. This proposal is directly inspired by AML research, where such uncertainty sampling is a common, computationally efficient method for selecting training data for artificial classifiers. The paper (a) describes a range of sampling models varying in how much they integrate information about alternative categories to predict what's useful to sample, then (b) presents an experiment testing between these accounts, then (c) discusses implications for understanding self-directed learning.

## 2. Uncertainty sampling in AML

Gathering informative training data efficiently is a core problem in machine learning just as it is for human learners: labeled training data is often expensive to obtain (e.g., a credit-card company needing costly human review to label fraudulent transactions before a supervised classifier can be trained on them). Given high labeling costs, only instances expected to improve model accuracy should be selected for labeling. AML research addresses how to make such selections to maximize accuracy, with applications in text classification, natural language processing, and recommendation systems.

Early AML work drew on the same optimal-experimental-design framework that has guided the psychological normative-sampling research described above — the same class of normative models applied to studies of human sampling has also been applied to machine classifiers. These models are often "**prospective**": they estimate the value of an observation by simulating the effect of each of its possible outcomes on the current model. For example, **information gain** formalizes the reduction in uncertainty achieved for each possible labeling of a potential training item (e.g., a reviewer labeling a transaction fraudulent or not), and the overall expected value of selecting that item is the outcome-value weighted by each outcome's predicted likelihood.

However, this prospective approach is computationally intractable in many ML applications. As a result, researchers have also developed methods for sampling an item based on a model's *current* classification uncertainty about it — which doesn't require estimating the effect of actually observing the item. Using current uncertainty to decide what to sample is cheaper computationally and, in many cases, achieves similar efficiency gains to the prospective approach.

The paper describes a set of simple **uncertainty-sampling** models (originally from Settles, 2012) that predict an item's sampling value from classification uncertainty, differing in *how* uncertainty about alternative categories is integrated into the sampling decision. For a potential item *x*, there is a set of possible category labels {y₁, y₂, …}, with probability distribution *p(y|x)* over them; the models differ in how that distribution is used to decide whether *x* should be sampled.

### 2.1 Information gain and label entropy

**Label entropy** — the Shannon entropy over the label distribution *p(y|x)* for item *x*:

`LE(x) = −Σᵢ p(yᵢ|x) · ln p(yᵢ|x)` (Eq. 1)

Shannon entropy measures disagreement across the possible labels for an item.¹ Entropy is highest when all labels are predicted equally, and lowest (zero) when a certain single-label prediction is made. So *label entropy* quantifies how much predictive uncertainty the observer has about item *x*'s classification — items that are hard to predict are assumed to be the most useful to observe, since they represent an aspect of the world where the learner is uncertain and would benefit from feedback.

*Label entropy* is common in AML but is also closely tied to normative cognitive-psychology models. In fact, when hypotheses are **deterministic** (each observation's likelihood under any hypothesis is either 1 or 0), *label entropy* is formally **equivalent** to *information gain*, a prospective normative model that has been used to account for human sampling behavior across many tasks. The proof:

Given a set of prior observations *D*, uncertainty over the hypothesis space ℋ (with uniform prior) is the Shannon entropy of the posterior:

`I(p(h|D)) = −Σ_{h∈ℋ} p(h|D) · ln p(h|D) = −ln(1/N) = ln N` (Eqs. 2–3)

where *N* is the number of hypotheses in ℋ consistent with *D*. **Information gain** for a candidate observation ⟨x, yᵢ⟩ is the reduction in this uncertainty from observing that *x* has label *yᵢ*:

`IG(⟨x,yᵢ⟩) = I(p(h|D)) − I(p(h|⟨x,yᵢ⟩, D)) = ln N − ln Nᵢ = ln(N/Nᵢ)` (Eqs. 4–5)

where *Nᵢ* is the number of remaining hypotheses consistent with *x* having label *yᵢ*. Since the true outcome is unknown, **expected information gain** weights each possible outcome by its probability:

`E[IG(⟨x,y⟩)] = Σᵢ p(yᵢ|x) · IG(⟨x,yᵢ⟩) = Σᵢ p(yᵢ|x)·ln(N/Nᵢ) = −Σᵢ p(yᵢ|x)·ln(Nᵢ/N) = −Σᵢ p(yᵢ|x)·ln p(yᵢ|x)` (Eqs. 6–9)

Equation 9 is identical to the definition of *label entropy* (Eq. 1). So for deterministic hypotheses, the one-step-ahead expected information gain of a query equals the entropy over its possible outcomes — maximized when an item is "**globally**" uncertain, i.e., all outcomes equally probable (which, under a uniform hypothesis prior, occurs when each outcome is predicted by an equal number of plausible hypotheses).

This provides a formal bridge between one uncertainty-sampling model (*label entropy*) and a prospective normative standard used to model human behavior (*information gain*): under deterministic hypotheses the two are identical, so sampling by *label entropy* is consistent with a normative account that integrates the full hypothesis set.

### 2.2 Margin sampling

Although focusing on globally uncertain/unpredictable items seems intuitively useful, there's reason to doubt it's the strategy humans actually use, especially in complex, multivariate learning environments. One natural strategy *not* captured by *label entropy*: decomposing a complex task into simpler subproblems by focusing on uncertainty about the boundary between just **two** categories at a time. This is formalized as **label margin**:

`LM(x) = 1 − (p₁ − p₂)` (Eq. 10)

where the label distribution *p(y|x)* is ordered from highest to lowest probability {p₁, p₂, …}, and *p₁* is the highest label probability for *x*.

Critically, *label margin* is **not** maximized only for items the learner is globally uncertain about. Instead, it prefers **local** sources of uncertainty among a *subset* of possible outcomes. Whereas *label entropy* integrates information about all possible labelings of an item, *label margin* relies only on the two most likely outcomes, disregarding the rest of the label distribution — reflecting an intermediate sampling strategy in which only a *subset* of possible alternatives (e.g., two of several categories) is used to evaluate a potential training item's value.

### 2.3 Most certain

Prior hypothesis-testing work suggests people may instead prefer items they can already classify with high confidence — a well-documented bias toward seeking *positive* evidence for one's current hypothesis. This is quantified as:

`MC(x) = max(p(y|x))` (Eq. 11)

*Most certain*'s predictions directly *contrast* with *label entropy*: highest value goes to items that can already be confidently classified. It is one way of instantiating **confirmatory sampling** — preferring items for which the learner already has a strong prediction about the category label.

## 3. Empirical studies of information sampling during category learning in humans

### 3.1 Prior work and its limitation

In a prior study, the authors examined self-directed information selection and category learning using two categories of "antennas" varying along two perceptual dimensions (circle size, and orientation of a central line segment; Fig. 1), each mapped to one of two TV "channels" (CH1 or CH2). A **self-directed** condition (participants designed which stimuli to learn about) was compared against a **passive** condition (instances generated from predefined distributions). A key finding: for simple uni-dimensional category rules, self-directed learners acquired the correct rule *faster* than passive learners.

Given evidence that self-directed sampling can speed learning, understanding **how** people decide what data to collect is important. One natural hypothesis: a self-directed learner should direct attention to items they're highly uncertain how to classify, ignoring items already confidently classified/predicted. Consistent with this, the pattern of stimuli sampled by self-directed learners in the prior study showed participants systematically directed their samples toward the **category boundary** as the task progressed (Fig. 1B), suggesting a preference for items they were uncertain how to classify.

However, that earlier study **could not identify which specific sampling model** best accounted for people's decisions, for two reasons:
1. Participants' *subjective* uncertainty about the items they chose to sample was not directly measured, and can't simply be inferred from which items were chosen — a given item could carry high or low subjective uncertainty depending on how much the person had already learned, regardless of where it sits in the objective stimulus space.
2. The prior study's task was **binary classification**, which precludes distinguishing *label entropy* from *label margin* — the two models make highly similar predictions in a binary task (Fig. 2, top row). For a binary problem, an item that can be confidently classified (e.g., *p(y|x)* = (1,0)) gets low value under both *label entropy* and *label margin*, but high value under *most certain*. Items near the center of the space get the highest, near-identical value under both *label entropy* and *label margin*, making them empirically indistinguishable in a binary task. Settles noted these models' predictions **diverge** for more complex (e.g., ternary) categorization tasks: in a ternary task (Fig. 2, bottom row), *label entropy* prefers items where **all three** classes are plausible (e.g., near the junction where all three category boundaries meet), while *label margin* assigns maximum value to items where one category is highly unlikely but the learner is uncertain between the *other two* (high value along the radial midpoint of each edge of the probability simplex). In short, *label margin* predicts samples will cluster near **any** boundary between two categories, not specifically the three-way junction.

### 3.2 The present study's design

The present experiment extends the antenna paradigm from Markant and Gureckis to a **ternary** classification problem specifically to separate the predictions of the three sampling models. Participants collected information by sampling new instances and receiving feedback about category membership. To obtain a direct estimate of a learner's subjective uncertainty at each point in time, they also judged the likelihood that each sampled instance belonged to each of the three categories, **before** receiving feedback about its true label.

**Predictions going in:** based on past AML/psychology work, the authors expected either *most certain* or *label entropy* to provide the best fit for a majority of participants. They further hypothesized that participants best described by *label entropy* would be *more* successful learners, since that sampling strategy makes more efficient use of task information. **Foreshadowing the results: both of these predictions were disconfirmed** — most participants were better accounted for by the *label margin* strategy, and label-margin-classified participants were *more* likely to successfully learn the target rule than participants classified by the other models.

## 4. Experiment

### 4.1 Participants

Sixty NYU undergraduates participated for course credit; one was excluded for ending the task early (**N = 59** analyzed for the main design; two more excluded later specifically from the probability-judgment analysis — see §4.4.2). Standard desktop computers, single 1-hour session.

### 4.2 Stimuli

Each stimulus's category label was deterministically defined by a **ternary classification rule** with the boundary structure shown in Fig. 2 (bottom row: three pie-slice-like regions in the 2D stimulus space, mapped to CH1/CH2/CH3). Three additional rule variants were created by rotating the same boundary structure 90°, 180°, and 270°. Each participant was randomly assigned to one of the four rotated rules (yielding *N* = {16, 14, 15, 14} participants per rule) and a random mapping of category labels ("CH1," "CH2," "CH3") to the rule's three regions.

Training stimuli were chosen by participants (see Procedure below). Test-block stimuli were generated by subdividing the 2D stimulus space into a grid of 36 equally sized regions and drawing one random stimulus from each region (ensuring even coverage of the space for testing, independent of what participants chose to sample during training).

### 4.3 Procedure

Participants were told the stimuli were television "loop antennas," each receiving one of three channels (CH1, CH2, or CH3), and their goal was to learn to distinguish the three antenna types well enough to correctly classify new antennas during test blocks. The experiment alternated between **training blocks** (8 trials each) and **test blocks** (36 trials each). Participants were told the experiment would end once they correctly classified 34/36 test items (94%) in a single test block; if a participant never reached that criterion, the experiment ended after 16 rounds or at the 1-hour mark, whichever came first.

**Training trials:** Participants sampled a new antenna by adjusting its size and orientation and then receiving feedback on which channel it would be assigned. They were told to design antennas they thought would be useful for predicting the channel of *other, not-yet-tested* designs. Each trial began with a randomly generated antenna; participants adjusted size (via mouse, moving left-to-right while holding "Z") and orientation (holding "X"), one dimension at a time, any number of changes, self-paced, then clicked the mouse to request feedback.

**Before** feedback was shown, participants judged, via three independent rating scales (Fig. 3, top; one scale visible at a time), how likely their designed antenna was to receive **each** of the three channels. Scale endpoints/labels indicated degrees of subjective probability, but responses could fall anywhere on the continuum; a response was required for each scale with no time limit. The mouse cursor's initial position on each scale was randomized, enabling the authors to check whether responses were driven merely by the cursor's starting position (see exclusion criterion below).

After all three probability judgments, feedback (the true category label plus the participant's own just-entered probability judgments, side by side; Fig. 3, bottom) was shown above the antenna for 4 seconds, helping the participant compare their prediction against the ground truth.

**Test trials:** each block of 8 training trials was followed by 36 test trials. On each, a single item appeared centered on the display and the participant classified it (self-paced, no feedback given per-trial). At the end of each test block, participants were told their overall block accuracy.

### 4.4 Results

#### 4.4.1 Classification performance

36 of 59 participants (**62%**) reached the 94% accuracy criterion within the available time.³ Among those, average blocks-to-criterion = 6 (*SD* = 3.1). For participants who did *not* reach criterion, average blocks completed = 9.8 (*SD* = 3.6).

#### 4.4.2 Probability judgments — data cleaning

Each training trial produced three probability values (one per category) based on click position on each scale. To check for degenerate "just click wherever the cursor starts" non-responding, the authors compared each response's click position to the scale's randomized initial cursor position; a trial was flagged a **non-response** if the click didn't differ from the initial cursor position by more than 5% of the scale, on at least one of the three ratings (a deliberately conservative cutoff to exclude potentially-biased partial judgments). Under this criterion, the average proportion of non-response trials across participants was **.33** (*SD* =.17). **Two participants were excluded** from further probability-judgment analysis because their non-response proportion was more than 3 SD above the group mean (83% and 94% non-response, respectively) — leaving **57 participants** for the model-fitting analyses below.

#### 4.4.3 Overall model fits

**Goal:** assess how well each of the three sampling models (*label entropy*, *label margin*, *most certain*) fit each participant's set of probability judgments.

**Method:** For each model, the authors used rejection sampling to build a relative-frequency histogram approximating a probability density function over the 3-category probability simplex (as visualized in Fig. 2 bottom row) — computing the proportion of 1 million random samples falling within each of 400 equally sized triangular bins tiling the simplex. Each participant's triplet of ratings on a given trial was normalized to sum to 1 (a location in the same simplex space); the estimated probability of a given rating-triplet *rₜ* was then the proportion of the model's samples falling in the *same bin* as that judgment, *F(rₜ)*.

Each participant's full sequence of judgments was fit to each model using the **softmax choice rule**:

`p(rₜ) = e^{F(rₜ)/b} / Σ_{z∈Z} e^{F(z)/b}` (Eq. 12)

where *b* is a free temperature parameter and *Z* is the full set of possible response bins. A *b* near zero implies the participant consistently chose the maximum-value sample under that model; higher *b* implies more random sampling. (See paper's Table 1 for quartiles of best-fit *b* values per model: *LE* Q1/Q2/Q3 =.0003/.0004/.0010; *LM* =.0006/.0010/.0031; *MC* =.0016/.0021/.0053 — i.e., *label entropy* fits tended to imply the most consistent/least-random sampling, *most certain* the most random-looking.) The log-likelihood of each of a participant's judgments under a given model (using only responses classified as non-degenerate) was summed across all their trials to get an overall per-model score.

**Classification by best-fit model:** each participant was assigned to whichever model gave the highest overall log-likelihood.
- **17 people (30%)** best fit by *label entropy*
- **32 people (56%)** best fit by *label margin*
- **8 people (14%)** best fit by *most certain*

Plotting participants' actual probability judgments within the simplex, grouped by best-fitting model (Fig. 4A), visually matched the qualitative predictions shown earlier in Fig. 2 for each respective model.

#### 4.4.4 Relating sampling decisions to learning

**By best-fit-model group:** Among participants who *reached* the learning criterion: 23 (64%) were best-fit by *label margin*, 9 (25%) by *label entropy*, 4 (11%) by *most certain*. Among those who *failed* to reach criterion: 8 were best-fit by *label entropy*, 9 by *label margin*, 4 by *most certain* (Fig. 4B).

**A finer-grained analysis (region-based, not just best-fit classification):** although *label margin* was the modal best-fit model overall, individuals' judgments were generally somewhat heterogeneous, with some trials more consistent with one model and other trials more consistent with another. Rather than relying solely on each participant's single best-fit label, the authors additionally tested whether the **frequency** with which someone's judgments fell into each model's characteristic region of the simplex predicted learning success. They partitioned the probability space into 3 equally sized regions, each corresponding to where one model uniquely predicts high value relative to the others (Fig. 5, left) — noting that with this method the *label margin* region specifically **excludes** the center-of-simplex samples that are *also* predicted by *label entropy* (i.e., these regions were constructed to be more cleanly diagnostic than the raw best-fit classification).

Each judgment was categorized by which region it fell in, and the proportion of a participant's samples falling in each region was computed and compared between those who did vs. didn't reach the learning criterion (Fig. 5, right):
- **Label margin region**: participants who reached criterion made significantly **more** samples in this region than those who didn't, *t*(55) = 2.04, *p* <.05.
- **Label entropy region**: no significant difference between learners and non-learners, *t*(55) = 0.44, *p* =.6.
- **Most certain region**: no significant difference, *t*(55) = 0.06, *p* =.95.

**Conclusion:** successful learning of the target rule was specifically associated with increased sampling of items most consistent with the *label margin* model — not with global uncertainty (*label entropy*) or confirmatory certainty-seeking (*most certain*).⁴

## 5. Discussion

In many real-world settings, people control what information forms the basis of their learning and decision-making — so their performance often hinges on how they make sampling decisions, and specifically whether those decisions facilitate new learning or simply reinforce existing beliefs. Prior research paints a mixed picture: a long history of hypothesis-testing work supports the view that people tend to be "confirmatory" samplers, seeking data consistent with / strongly predicted by a focal hypothesis, whereas normative theories of information acquisition propose people search for information that optimizes the amount of information conveyed by their actions. Under many conditions these two theories make qualitatively distinct predictions about what people will sample — but it's also useful to consider them as two extremes along a dimension of how much information about alternatives contributes to sampling decisions. The generation and/or use of alternative hypotheses has broadly been linked to reasoning quality and decision quality, and considering alternatives has often been proposed as a key factor mediating confirmatory vs. normative sampling — but this dichotomy has usually been treated as a binary distinction rather than a continuum. The authors argue that in even moderately complex problems requiring reasoning about alternative hypotheses, the best account of sampling behavior may lie at a more **intermediate** point on this continuum.

### 5.1 Margin sampling: a preference for "local" classification uncertainty

The study found clear evidence for such an intermediate sampling behavior: a majority of participants were best described overall by *label margin*. Under this model, items are preferred when they're likely to belong to **two** categories specifically (independent of the likelihood of any *remaining* categories) — formalizing the idea that people seek information reducing "local" sources of uncertainty about a *subset* of alternatives. This contrasts with normative models (including *information gain*, which is formally identical to *label entropy* in this task's deterministic setting), which predict people should sample according to a "global" measure of uncertainty, with the strongest preference for items equally likely to belong to *any* category. For an ideal observer in this specific task, globally uncertain items convey the *most* information about possible classification rules — margin sampling should, in principle, only reduce learning efficiency, since it rules out fewer alternative rules per sampled item (a gap that widens as the number of possible categories increases).

In addition, a tendency toward margin sampling was associated with *more successful* learning of the target rule, relative to the other models tested — people best-fit by *label margin* were more likely overall to reach the learning criterion, and (across all participants, not just those best-fit by the model) the frequency of sampling items strongly predicted by *label margin* specifically (but not *label entropy*) was related to whether the criterion was reached.

**Why might people prefer margin sampling despite its apparent normative inefficiency?** The evidence for margin sampling suggests a general preference for a *local* form of exploration, though the data don't directly diagnose the underlying cognitive process. Possibilities the authors raise:

1. **Problem decomposition.** In a multidimensional task like this one, people may decompose the problem into simpler components. This piecemeal strategy could be more effective when it's difficult to simultaneously consider many alternatives or process information about multiple feature dimensions at once — margin sampling may reflect an adaptation whereby people isolate individual components to learn about in succession, akin to the "control of variables" strategy central to scientific thinking more generally. Alternatively, even without deliberately using this strategy, people may have simply *learned* over prior experience that margin sampling tends to be effective, and ascribe higher utility to margin-predicted items as a result — a question the current design can't distinguish.
2. **Easier feedback integration for dichotomous tests.** If a learner is completely uncertain about an item (globally uncertain), feedback that it belongs to category "A" may be *harder* to integrate into their understanding (since they had no strong prior prediction to update from). For items where the participant is uncertain between only *two* categories, in contrast, feedback can be more decisive/informative to integrate. This constraint may matter increasingly as the number of possible category labels/outcomes for a given query grows.

**A limitation the authors note:** reliance on participants' self-reported probability judgments, since there was no cost for reporting one's subjective belief inaccurately. The randomized-cursor-start check helped detect (and exclude) failures to respond effortfully, but it remains possible that self-reported judgments were biased in some other way by the self-report procedure itself; validating margin sampling via alternative measures of subjective uncertainty is left to future work.

### 5.2 Relation to other modeling approaches

Although the normative models discussed are generally intended as computational (not process-level) accounts of sampling behavior, it's still useful to consider their implications for process-level models of *how* sampling decisions are actually made. A model like *information gain* implies a **prospective** process, in which the expected outcomes of an observation are combined to estimate their effect on current beliefs. The authors argue this kind of prospective evaluation is unlikely to be how people actually operate, particularly in unfamiliar or complex problems — but people may use *simpler* forms of uncertainty that nonetheless yield similar gains. This computational-cost/optimality trade-off mirrors AML research showing uncertainty sampling (which avoids prospective evaluation) is a widely applicable, efficient way to improve training efficiency.

Specifically, the paper's earlier proof (§2.1) showed that when hypotheses are deterministic, *information gain* is equivalent to sampling by *label entropy* — meaning people using uncertainty sampling need only assess their uncertainty about how to classify an item, without prospectively simulating outcomes, yet remain consistent with normative principles in this setting. This is a general-purpose strategy that's *less* cognitively demanding but often *consistent* with normative sampling. A related point has been made in recent analyses showing positive testing can itself be equivalent to information gain under certain conditions — e.g., Austerweil and Griffiths showed that when hypotheses make deterministic predictions about the next event in a sequence, testing the *most probable* hypothesis's prediction (e.g., asking "is the next event A?" and getting yes/no feedback) maximizes information gain. The current analysis is complementary in that it applies to selecting *queries* without committing to a specific predicted outcome (e.g., simply asking "what is this?" and receiving a full label) — when hypotheses make deterministic predictions about category membership, an item's label uncertainty is directly related to how informative it will be in this setting.

Within the uncertainty-sampling framework, the paper's *label margin* model is an example of an **intermediate sampling process**, similar in spirit to "rational process models" that embody optimal decision-making relative to an *approximate* representation of the hypothesis space, where the fidelity of that representation can range from a single-point estimate up to the full distribution of alternatives. Such a graded representation could arise from a limited capacity for storing alternatives in memory, leading to search decisions that reduce uncertainty about only the "local" set of alternatives currently under active consideration. Whether this preference is caused by memory/storage limits specifically, versus something *learned* over the course of experience with similar problems, remains an open question for further work.

Finally, although the paper focuses on margin sampling, people might in principle pool information about *any* subset of alternatives when evaluating potential samples. Another AML model, **least confident**, evaluates selections based on confidence in the single *most likely* label; its predictions are relatively similar to *label margin* in this particular study, so *least confident* might represent another intermediate form of sampling that's efficient across many problems people face. In general, in rule-based reasoning it's likely that the number of alternatives people actively consider at any moment is relatively small, and that forms of *local* uncertainty sampling provide the best account of how people decide what information to collect.

## 6. Acknowledgments

This work was supported by grant number BCS-1255538 from the National Science Foundation and the Intelligence Advanced Research Projects Activity (IARPA) via Department of the Interior (DOI) contract D10PC20023 to T.M.G. The U.S. Government is authorized to reproduce and distribute reprints for Governmental purposes notwithstanding any copyright annotation thereon. The views and conclusions contained herein are those of the authors and should not be interpreted as necessarily representing the official policies or endorsements, either expressed or implied, of IARPA, DOI, or the U.S. Government.

## Notes (from the original article)

1. The more general term *confirmation bias* has been used to refer both to confirmatory forms of sampling (such as the PTS) and to biased responses to evidence (e.g., overweighting data consistent with a favored hypothesis). Note that a confirmatory *sampling* process on its own does not necessarily imply a bias in the learner's beliefs, but it can cause learning to be less efficient than other strategies.
2. The unit of measure for entropy depends on the base of the logarithm in Eq. 1, but different units are related by a constant multiple (e.g., 1 *nat* equals 1.44 *bits* of information).
3. No differences were found between the four variations of the category rule at any point in the analysis (G tests of independence, all *p* >.05).
4. Although the non-response exclusion criterion was chosen prior to the experiment, the authors additionally checked whether results depended on that specific value by re-running with different criteria. Results were highly similar across criteria, with one notable exception: the difference in proportion of *label margin* samples became marginal under other criteria (e.g., doubling the non-response threshold to.1 yields *p* =.056 for that comparison). These additional analyses are available upon request.
