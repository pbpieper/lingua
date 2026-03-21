# Lingua: Linguistic Foundations and Pedagogical Design

*A guide for language teachers, curriculum designers, SLA researchers, and linguistically-minded learners*

---

## Table of Contents

1. [Theoretical Foundations](#1-theoretical-foundations)
2. [Spaced Repetition: From Ebbinghaus to FSRS-4.5](#2-spaced-repetition-from-ebbinghaus-to-fsrs-45)
3. [The Pre-Learn Pipeline: Bridging Input and Acquisition](#3-the-pre-learn-pipeline-bridging-input-and-acquisition)
4. [Tool Design Rationale](#4-tool-design-rationale)
5. [CEFR Alignment](#5-cefr-alignment)
6. [Vocabulary Acquisition Metrics](#6-vocabulary-acquisition-metrics)
7. [RTL and Script Considerations](#7-rtl-and-script-considerations)
8. [Privacy and Ethical Considerations in AI-Assisted Language Learning](#8-privacy-and-ethical-considerations-in-ai-assisted-language-learning)
9. [References](#9-references)

---

## 1. Theoretical Foundations

### 1.1 Krashen's Input Hypothesis and Comprehensible Input

Stephen Krashen's Input Hypothesis (Krashen, 1985) remains one of the most influential frameworks in second language acquisition (SLA). Its central claim is that language is acquired -- not merely learned -- when learners are exposed to input that is slightly beyond their current competence level, expressed as *i+1*. Acquisition, in Krashen's framework, is a subconscious process that occurs when the learner's attention is on meaning rather than form.

Lingua's architecture is designed around this principle. The **reading-first approach** treats authentic text as the primary vehicle for acquisition: learners encounter vocabulary in context, absorb grammatical patterns implicitly, and develop intuitions about usage that no decontextualized drill can replicate. The **Reading Assist** tool presents foreign-language texts with inline hover translations, allowing learners to process meaning without breaking the reading flow -- maintaining the conditions under which Krashen argues acquisition occurs.

The **Pre-Learn Pipeline** operationalizes i+1 from the preparation side. When a learner pastes a text, the system identifies unknown words and offers targeted pre-teaching, converting what would have been incomprehensible input (*i+5* or worse) into comprehensible input at the *i+1* threshold. This is what Nation (2013) calls "deliberate vocabulary learning in service of meaning-focused input."

The **Stories** tool approaches i+1 from the generation side. Using Ollama (a local LLM), it produces graded reading passages calibrated to the learner's current vocabulary profile, constraining the generative model to use primarily known vocabulary with a controlled proportion of new items.

Critically, Lingua does not rely on input alone. Krashen's hypothesis has been productively critiqued for undervaluing the role of output (Swain, 1985) and interaction (Long, 1996). Lingua addresses these critiques by pairing comprehensible input with tools for writing, speaking, and form-focused practice, creating an environment where input provides the foundation and output drives learners to notice gaps in their interlanguage.

### 1.2 Nation's Four Strands

Paul Nation's Four Strands framework (Nation, 2007) proposes that a well-balanced language course should include roughly equal amounts of four types of activity:

1. **Meaning-focused input** -- learning through listening and reading where the focus is on understanding messages. In Lingua: *Reading Assist*, *Stories*, *Listening*, *Pre-Learn Pipeline*.

2. **Meaning-focused output** -- learning through speaking and writing where the focus is on conveying messages. In Lingua: *Writing*, *Speaking*, *Fill-in-the-Blank*.

3. **Language-focused learning** -- deliberate attention to language features such as vocabulary, grammar, and pronunciation. In Lingua: *Flashcards*, *Grammar*, *Sentence Cloze*, *Match Game*, *Quiz*, *Word Bank*, *Upload*.

4. **Fluency development** -- activities where learners operate with known language at faster speeds. In Lingua: *Match Game* (timed mode), *Flashcards* (cram mode), *Multiple Choice Quiz* (timed), and repeated reading within *Reading Assist*.

Nation's framework cautions against programs that over-emphasize any single strand. Lingua's sidebar organizes tools into Learn, Practice, and Track categories, and the **Smart Daily Study Plan** algorithm actively balances strand coverage by recommending tools the learner has not recently used, ensuring no strand is neglected across sessions. By distributing its 21 tools across all four strands, Lingua avoids the common pitfall of vocabulary apps that focus exclusively on language-focused learning while neglecting the input, output, and fluency strands where durable acquisition takes place.

### 1.3 Lexical Frequency Profile and Coverage Thresholds

Laufer and Nation (1995) demonstrated that a learner's vocabulary size can predict reading comprehension more reliably than many other variables. Their Lexical Frequency Profile approach segments text by word frequency bands, revealing how much of a text a learner can access with their current vocabulary.

Two thresholds have emerged from this research as practically significant:

- **95% coverage**: The learner knows 95 out of every 100 running words. At this level, the learner can follow the gist of a text but will encounter one unknown word every two lines -- enough to cause frequent comprehension breakdowns in unsupported reading (Laufer, 1989).

- **98% coverage**: The learner knows 98 out of every 100 running words. Hu and Nation (2000) found this to be the threshold for *unassisted* reading comprehension -- the point at which readers can infer the meaning of remaining unknown words from context with reasonable success.

Lingua's Pre-Learn Pipeline operationalizes these thresholds directly. When a learner pastes a text, the system tokenizes it, cross-references each lemma against the learner's known vocabulary, and produces a **comprehension estimate** -- the percentage of running words the learner already knows. The interface displays feedback calibrated to these research-based thresholds: below 80% signals significant struggle, 80-94% indicates gist comprehension, 95-97% suggests good comprehension with occasional gaps, and 98%+ indicates readiness for unassisted reading.

### 1.4 Incidental vs. Intentional Vocabulary Acquisition

SLA research distinguishes between two modes of vocabulary learning. **Incidental acquisition** occurs when words are picked up as a byproduct of reading or listening for meaning (Hulstijn, 2001). **Intentional learning** involves deliberate study of word form, meaning, and use through flashcards, word lists, and similar activities (Nation, 2001).

Both modes are necessary. Incidental acquisition builds rich contextual knowledge -- collocations, register, pragmatic nuance -- but is slow and requires massive amounts of input. A learner may need 10-16 encounters with a word before it is acquired incidentally (Webb, 2007). Intentional learning is faster for establishing initial form-meaning mappings but produces shallower knowledge that can fade without reinforcement in context.

Lingua's Pre-Learn Pipeline bridges these two modes. The learner begins with intentional study -- reviewing unknown words via flashcards before reading -- and then transitions to incidental acquisition as those same words appear naturally in the text. This sequence ensures that the reading experience remains at the *i+1* level: the text is challenging enough to drive acquisition but comprehensible enough to sustain engagement. Research on textual glossing (Hulstijn, Hollander, & Greidanus, 1996; Yoshii, 2006) consistently demonstrates that this combination of pre-teaching and in-context encounter produces superior retention compared to either approach in isolation.

---

## 2. Spaced Repetition: From Ebbinghaus to FSRS-4.5

### 2.1 Historical Context

The scientific study of memory retention begins with Hermann Ebbinghaus (1885), whose self-experimentation with nonsense syllables produced the **forgetting curve** -- the observation that memory decays exponentially over time unless material is reviewed at strategic intervals. Ebbinghaus found that after 20 minutes, 42% of learned material was forgotten; after one day, 67%; after one month, 79%. However, each review strengthened the memory trace and slowed the rate of decay, establishing the foundational principle of spaced repetition.

**Leitner boxes** (Leitner, 1972) provided the first practical implementation for language learners: physical flashcards move between numbered boxes based on correct or incorrect recalls, with each box reviewed at increasing intervals. This system introduced the core principle that well-remembered items need fewer reviews, enabling learners to focus their limited study time on the words they find most difficult.

**SM-2** (Wozniak, 1990), developed for SuperMemo, added algorithmic sophistication. It assigned each card an *ease factor* (a multiplier governing interval growth) and adjusted this factor based on the quality of each recall, rated on a 0-5 scale. SM-2 became the dominant algorithm in digital flashcard applications, most notably Anki, and remained the standard for over three decades.

### 2.2 Why FSRS-4.5 over SM-2

Despite its longevity, SM-2 has significant limitations. Its ease factor is a single scalar that conflates two distinct properties: how inherently difficult a card is (a stable trait) and how well the learner currently remembers it (a dynamic state). This conflation leads to the well-documented "ease hell" problem, where a few failed reviews permanently reduce a card's ease factor, causing it to be reviewed far more often than necessary -- sometimes indefinitely.

**FSRS-4.5** (Free Spaced Repetition Scheduler, version 4.5) addresses these issues with a model grounded in memory research (Ye, 2024). It separates the factors that SM-2 conflates, producing a more accurate and efficient scheduling model.

### 2.3 How FSRS Parameters Work

FSRS tracks three parameters per card:

- **Stability (S)**: The time, in days, after which the probability of recall drops to a target threshold. Higher stability means the memory is more durable. Unlike SM-2's ease factor, stability increases monotonically with successful reviews -- a correct recall always makes the memory stronger, never weaker.

- **Difficulty (D)**: A value representing the inherent difficulty of the card. This is a relatively stable property: some words are simply harder to remember than others due to phonological distance from the L1, semantic complexity, lack of cognates, or interference from similar forms. Difficulty is updated gradually based on review performance but is not subject to the dramatic swings that characterize SM-2's ease factor.

- **Retrievability (R)**: The current probability that the learner can recall the card, computed as a function of elapsed time since the last review and the card's stability. When retrievability drops below a configurable threshold (typically 0.9), the card becomes due for review. This parameter provides the real-time signal that drives scheduling decisions.

Empirical benchmarks show that FSRS-4.5 schedules approximately **30% fewer reviews** than SM-2 for equivalent retention rates (Ye, 2024). This efficiency gain comes from the algorithm's ability to model each card individually: a high-stability, low-difficulty card (e.g., a cognate the learner recognized immediately) will not be scheduled for review for weeks or months, while a low-stability, high-difficulty card (e.g., a word with no L1 cognate and confusable phonology) will be reviewed more frequently.

### 2.4 Desirable Difficulties

Bjork (1994) introduced the concept of **desirable difficulties** -- conditions that make initial learning harder but improve long-term retention. Spacing reviews (rather than massing them), interleaving different types of material, and testing rather than restudying are all desirable difficulties supported by extensive experimental evidence (Bjork & Bjork, 2011).

FSRS-4.5 naturally implements desirable difficulties through its retrievability-based scheduling. Cards are presented for review precisely when the learner is likely to find recall effortful but achievable -- the zone where memory consolidation is strongest. The system does not wait until the learner has forgotten (which would waste the existing memory trace) nor review too early (which would provide minimal learning benefit). This optimal scheduling window represents what Bjork calls the "region of proximal learning" for memory -- analogous to Vygotsky's zone of proximal development for skill acquisition.

Lingua further supports desirable difficulties through tool interleaving: the Smart Daily Study Plan recommends alternating between different practice types rather than massing a single activity, capitalizing on the interleaving effect documented by Rohrer and Taylor (2007).

---

## 3. The Pre-Learn Pipeline: Bridging Input and Acquisition

The Pre-Learn Pipeline is Lingua's signature feature, implementing a pedagogically motivated workflow that connects intentional vocabulary study to authentic reading. It is grounded in the convergence of three research findings: the 98% coverage threshold for unassisted reading (Hu & Nation, 2000), the superiority of pre-teaching over glossing-only approaches for low-coverage texts (Nation, 2013), and the depth of processing advantage of combining intentional and incidental learning (Hulstijn, 2001).

### 3.1 Text Analysis

When a learner submits a text, the backend performs the following operations:

1. **Tokenization**: The text is split into individual tokens, handling punctuation, contractions, and script-specific rules (including whitespace-delimited languages, Arabic morphology, and CJK character boundaries where supported).

2. **Lemmatization**: Tokens are reduced to their dictionary forms. This step is essential because a learner who knows *laufen* (to run) should not be counted as ignorant of *lief* (ran) or *gelaufen* (run, past participle). Lemmatization ensures that the coverage estimate reflects the learner's actual lexical knowledge rather than penalizing them for encountering inflected forms of known words.

3. **Known/unknown classification**: Each unique lemma is checked against the learner's Word Bank. Words present in the bank with sufficient FSRS stability are classified as **known**; all others are classified as **unknown**. This binary classification is a simplification -- word knowledge exists on a continuum (see Section 6.1) -- but it provides a practically useful signal for the coverage calculation.

### 3.2 Comprehension Estimate Calculation

The system computes a comprehension estimate as the ratio of known-word tokens to total tokens. This metric directly operationalizes the coverage research:

| Coverage | Interface Feedback | Research Basis |
|---|---|---|
| Below 80% | "You'll struggle with this text" | Well below minimum threshold (Laufer, 1989) |
| 80-94% | "You'll understand the gist" | Partial comprehension zone |
| 95-97% | "Good comprehension expected" | Laufer's (1989) adequate comprehension threshold |
| 98%+ | "You're ready for this text!" | Hu & Nation's (2000) unassisted reading threshold |

### 3.3 How Pre-Learning Maximizes Comprehensible Input

For each unknown word, the system uses Ollama to generate translations, part-of-speech tags, and gender information where applicable. The learner reviews and selects which words to study, then creates a vocabulary list that feeds directly into Flashcards, Match, or any other practice tool.

This workflow ensures that by the time the learner opens the text in Reading Assist, they have already established initial form-meaning connections for critical vocabulary. The reading experience then reinforces and deepens these connections through contextual encounter. The cognitive sequence -- intentional learning followed by incidental reinforcement -- produces what Schmitt (2008) describes as "incremental word knowledge growth," where each encounter adds a new dimension of knowledge (collocation, register, grammatical behavior) to the initial form-meaning mapping.

### 3.4 Connection to Hu and Nation (2000)

Hu and Nation's (2000) study is foundational to the Pre-Learn Pipeline's design. They tested reading comprehension at different vocabulary coverage levels and found that:

- At 80% coverage, no readers achieved adequate comprehension.
- At 90% coverage, a small minority achieved adequate comprehension.
- At 95% coverage, most readers achieved adequate comprehension with effort.
- At 98% coverage, most readers achieved adequate comprehension comfortably.

The Pre-Learn Pipeline's goal is to move learners from whatever their natural coverage level is to 95% or above before they begin reading. For a 500-word text where the learner knows 85% of the vocabulary, this means pre-teaching approximately 50-65 words -- a manageable study set that can be reviewed in 15-20 minutes of flashcard practice.

---

## 4. Tool Design Rationale

Each of Lingua's 21 tools is designed around specific findings from SLA and cognitive psychology research. Below is a mapping of the core practice tools to their theoretical motivations.

### 4.1 Flashcards -- Retrieval Practice and the Testing Effect

Roediger and Butler (2011) demonstrated that the act of retrieving information from memory strengthens the memory trace more effectively than restudying the same material. This **testing effect** is one of the most robust findings in cognitive science, replicated across hundreds of experiments and learning domains.

Lingua's Flashcards tool implements retrieval practice through FSRS-4.5 scheduling. **Bidirectional mode** exercises both receptive knowledge (L2-to-L1 recognition: "What does *Schmetterling* mean?") and productive knowledge (L1-to-L2 recall: "How do you say *butterfly*?"). Production cards are inherently harder than recognition cards -- a desirable difficulty (Bjork, 1994) -- and FSRS models them with separate stability and difficulty parameters. **Tag-based filtering** allows learners to target specific semantic fields or CEFR levels, while **cram mode** supports deadline-driven intensive review for examinations.

### 4.2 Reading Assist -- Extensive Reading with Glossing

Day and Bamford (1998) established the principles of **extensive reading**: learners read large quantities of text at an appropriate level, primarily for pleasure and general comprehension. A meta-analysis by Nakanishi (2015) confirmed that extensive reading improves vocabulary, grammar, reading speed, and writing quality.

Reading Assist enhances extensive reading with **glossing** -- inline translations that appear on hover. Glossing research (Hulstijn, Hollander, & Greidanus, 1996; Yoshii, 2006) shows that L1 glosses improve both comprehension and incidental vocabulary acquisition compared to unglossed reading, without significantly disrupting reading flow. Unknown words receive visual highlighting (color-coded overlays), creating what Krashen would recognize as an *i+1* environment where the known text provides context and the highlighted unknowns provide the growth edge.

### 4.3 Stories -- Narrow Reading and Graded Readers

The Stories tool generates AI-produced texts calibrated to the learner's vocabulary level, implementing the principle of **narrow reading** (Krashen, 2004) -- reading multiple texts on the same topic or in the same genre. Narrow reading maximizes repeated exposure to topic-relevant vocabulary, accelerating acquisition of those words through multiple contextualized encounters.

Graded reader research (Hill, 2008; Nation & Waring, 2020) supports the value of level-controlled texts: when grammatical and lexical complexity is matched to the learner's level, both enjoyment and learning outcomes improve. By generating stories dynamically from the learner's vocabulary profile, Lingua achieves a degree of personalization that static graded reader series cannot match.

### 4.4 Writing -- Output Hypothesis and Noticing

Swain's Output Hypothesis (1985, 1995) argues that producing language forces learners to process it at a deeper level than comprehension alone requires. Specifically, output triggers **noticing** -- the learner becomes aware of gaps between what they want to say and what they can say, driving them to seek input that fills those gaps. Swain identified three functions of output: the noticing/triggering function, the hypothesis-testing function, and the metalinguistic (reflective) function.

Lingua's Writing tool pairs free composition with AI-powered correction via Ollama, providing immediate feedback that helps learners notice and resolve gaps in their interlanguage. The AI correction serves as a form of **recast** -- reformulating the learner's intended meaning in target-like form -- which research (Lyster & Ranta, 1997) identifies as one of the most frequent and effective types of corrective feedback.

### 4.5 Speaking -- Interaction Hypothesis

Long's Interaction Hypothesis (1996) proposes that conversational interaction, particularly **negotiation of meaning** (clarification requests, confirmation checks, recasts), facilitates acquisition by making input comprehensible and drawing attention to form. The hypothesis builds on Krashen's Input Hypothesis but adds the crucial claim that interaction modifies input in ways that passive reception cannot.

The Speaking tool uses TTS (text-to-speech) for pronunciation modeling and Ollama for conversational interaction, creating a low-stakes environment where learners can practice oral production and receive AI-mediated feedback without the social anxiety that inhibits production in face-to-face settings (Horwitz, Horwitz, & Cope, 1986).

### 4.6 Sentence Cloze -- Context-Dependent Learning

Webb (2007) showed that learning words in sentence contexts produces stronger retention than learning words in isolation, particularly for productive knowledge. The advantage is attributed to deeper processing: contextual learning requires the learner to integrate the target word's meaning with the surrounding syntactic and semantic structure.

Cloze deletion -- removing a target word from a sentence and asking the learner to supply it -- combines the benefits of contextual learning with retrieval practice. Lingua's Sentence Cloze tool generates context sentences via Ollama, integrates with FSRS for scheduling, and uses fuzzy matching to accept minor spelling variations -- maintaining the testing effect while reducing frustration from superficial orthographic errors.

### 4.7 Grammar -- Form-Focused Instruction

Ellis (2001) distinguished between incidental and planned **form-focused instruction** (FFI), showing that explicit attention to grammatical forms, when integrated with communicative practice, accelerates acquisition of targeted structures. This is especially true for forms that are non-salient in input (e.g., third-person -s in English) or that differ markedly from the learner's L1 (e.g., grammatical gender for English speakers learning German).

The Grammar tool generates AI-powered lessons with exercises targeting specific grammatical structures, providing the explicit FFI component that complements Lingua's otherwise meaning-focused approach. Research by Norris and Ortega (2000), in a meta-analysis of 49 studies, found a substantial advantage for explicit instruction over implicit exposure for grammatical accuracy.

### 4.8 Match, Fill-in-the-Blank, and Quiz -- Depth of Processing

Craik and Lockhart's (1972) **depth of processing** framework predicts that deeper cognitive engagement with material leads to stronger memory traces. Matching words to translations (Match), generating words to complete sentences (Fill-in-the-Blank), and selecting correct answers from distractors (Quiz) each require different depths and types of processing:

- **Match** (recognition + speed): Engages form-meaning mapping under time pressure, building automaticity with known vocabulary -- a fluency development activity in Nation's framework.
- **Fill-in-the-Blank** (productive recall): Requires the learner to produce the correct form, engaging deeper processing than recognition tasks.
- **Quiz** (discriminative recognition): Forces the learner to distinguish between semantically related items, strengthening the precision of lexical knowledge.

### 4.9 Listening -- Phonological Encoding

The Listening tool, which plays TTS audio and asks learners to type what they hear, targets the phonological dimension of word knowledge. Research on the **phonological loop** (Baddeley, 2003) demonstrates that auditory-verbal rehearsal is a distinct pathway for encoding vocabulary, and that learners who can recognize words in speech retain them better than those who only encounter them in writing. Dictation exercises have a long history in language pedagogy (Davis & Rinvolucri, 1988) and remain effective because they integrate phonological decoding, orthographic encoding, and semantic processing in a single task.

### 4.10 Additional Tools

- **Word Bank** and **Upload**: Infrastructure tools that implement Nation's (2001) principle that effective vocabulary programs require systematic selection, sequencing, and tracking of target words.
- **Universe** (Vocabulary Galaxy): A spatial visualization of the learner's vocabulary, drawing on dual coding theory (Paivio, 1986) -- the principle that information encoded both verbally and visually is remembered better than information encoded in only one modality.
- **Home** (Daily Hub) and **Smart Daily Study Plan**: Implements spaced practice scheduling at the session level, not just the card level, ensuring balanced strand coverage and preventing the over-practice of comfortable activities.
- **Teacher Portal**: Enables formative assessment through assignment tracking and completion monitoring, aligned with assessment-for-learning principles (Black & Wiliam, 1998).
- **Community** (Leaderboard, Shared Lists, Friends): Leverages social motivation and cooperative learning (Deci & Ryan, 2000), while shared vocabulary lists enable what Nation (2001) calls "cooperative vocabulary learning."
- **Achievements**: Gamification elements (XP, badges, streaks) that support intrinsic motivation through competence feedback (Deci & Ryan, 2000).
- **Progress Dashboard**: Makes learning visible through heatmaps and charts, supporting self-regulated learning and metacognitive monitoring (Flavell, 1979).

---

## 5. CEFR Alignment

The **Common European Framework of Reference for Languages** (Council of Europe, 2001, 2020) provides a six-level proficiency scale (A1 through C2) that has become the global standard for language education. Lingua integrates CEFR at multiple levels.

### 5.1 Vocabulary Size Estimates by CEFR Level

Research on vocabulary size and CEFR levels (Milton, 2009; Alderson, 2005) suggests approximate thresholds:

| CEFR Level | Estimated Vocabulary Size | Description |
|---|---|---|
| A1 | ~500-1,000 words | Basic survival vocabulary: greetings, numbers, food, family |
| A2 | ~1,000-2,000 words | Routine social exchanges, shopping, directions |
| B1 | ~2,000-3,500 words | Independent reading of simplified texts, personal letters |
| B2 | ~3,500-5,000 words | Reading newspapers, following lectures, sustained conversation |
| C1 | ~5,000-8,000 words | Academic and professional fluency, nuanced expression |
| C2 | ~8,000-16,000+ words | Near-native range, literary and specialized vocabulary |

These estimates vary by language (agglutinative languages like Finnish and Turkish have higher lemma counts for equivalent proficiency) and measurement methodology (family-based counting vs. lemma-based counting), but they provide useful benchmarks for goal-setting and progress tracking.

### 5.2 Level-Appropriate Exercise Generation

Lingua's `cefr_level` field on each word enables level-aware tool behavior. AI-generated stories, grammar exercises, and sentence cloze items can be filtered or calibrated to the learner's current level, ensuring that practice materials remain within the *i+1* zone. The Grammar tool maps grammatical topics to CEFR levels (e.g., present tense at A1, subjunctive at B2, complex conditional at C1), following the CEFR's grammatical progression descriptors.

### 5.3 Can-Do Statements and Tool Mapping

CEFR Can-Do statements describe what learners can accomplish at each level. Lingua's tools map to these competences across the proficiency range:

- **A1-A2**: Flashcards (basic vocabulary building), Match (word recognition speed), Listening (phonological awareness of high-frequency words), Fill-in-the-Blank (basic sentence patterns), Upload (curated starter lists)
- **B1-B2**: Reading Assist (adapted and authentic texts), Stories (graded reading at current level), Writing (short compositions with AI feedback), Sentence Cloze (contextual vocabulary), Grammar (intermediate structures), Speaking (transactional conversations)
- **C1-C2**: Reading Assist (authentic literary and academic texts), Writing (extended compositions, argumentation), Speaking (sustained abstract discussion), Grammar (advanced structures, stylistic variation), Pre-Learn Pipeline (preparing for specialized texts)

---

## 6. Vocabulary Acquisition Metrics

### 6.1 What "Knowing a Word" Means

Nation (2001) proposed a comprehensive framework for word knowledge that includes three dimensions, each with receptive and productive aspects:

| Dimension | Receptive Knowledge | Productive Knowledge |
|---|---|---|
| **Form** | Recognize spoken and written form | Pronounce and spell correctly |
| **Meaning** | Map form to meaning, understand referents | Express meaning, distinguish from related words |
| **Use** | Recognize grammatical patterns, collocations | Use in correct grammatical contexts, natural collocations |

This nine-cell framework reveals that "knowing a word" is not a binary state but a multidimensional continuum. A learner may recognize *schadenfreude* in writing (receptive form knowledge) without being able to spell it (productive form knowledge) or use it in a grammatically correct German sentence (productive use knowledge).

No single test can assess all nine aspects. Lingua's multi-tool approach approximates broader coverage: Flashcards test form-meaning connections in both directions, Sentence Cloze tests collocational and grammatical knowledge, Writing tests productive use in discourse, Listening tests phonological form recognition, and Fill-in-the-Blank tests productive form recall.

### 6.2 How Lingua Tracks Partial Knowledge Through FSRS Parameters

FSRS's per-card parameters serve as proxies for depth of knowledge:

- **Low stability, high difficulty**: The learner has encountered the word but has not established a durable memory. This word requires additional exposures across multiple tools and contexts. It may indicate a word with no L1 cognate, confusable phonology, or abstract semantics.
- **High stability, low difficulty**: The word is well-known and requires infrequent review. The learner likely has robust receptive knowledge and may have productive knowledge as well. Cognates and high-frequency words often reach this state quickly.
- **High reps with moderate stability**: The word has been reviewed many times but retention remains fragile -- possibly due to interference from similar words (e.g., *kennen* vs. *konnen* in German), lack of contextual exposure, or inherent difficulty.

These FSRS states do not map perfectly onto Nation's knowledge dimensions, but they provide actionable signals: low-stability words can be prioritized for contextual practice (Sentence Cloze, Reading Assist), while high-stability words can be channeled into fluency activities (timed Match, cram mode).

### 6.3 Known Words Counter Methodology

Lingua's home screen displays a **Known Words** counter, inspired by LingQ's approach to making vocabulary growth visible and motivating. A word is counted as "known" when its FSRS stability exceeds a mastery threshold, indicating that the learner can reliably recall it over an extended period.

This metric is deliberately conservative. A word with one successful review is not yet "known" -- it has merely been encountered. The stability threshold ensures that the counter reflects durable knowledge rather than short-term recognition, aligning with Bahrick's (1984) research on "permastore" memory -- knowledge that persists over years without review.

### 6.4 Mastery Thresholds

Lingua defines mastery as the point at which a word's FSRS stability indicates a review interval of 21 days or more -- meaning the learner can recall the word with high probability (R >= 0.9) after three weeks without review. This threshold corresponds roughly to the point at which most forgetting curve research shows memory has consolidated into long-term storage (Bahrick, 1984).

Words that cross this threshold transition from the "learning" to the "known" category in the learner's statistics. They continue to be scheduled for review at increasingly sparse intervals (the "maintenance" phase), but they no longer dominate the learner's daily review queue. This design prevents the common frustration of spaced repetition systems where well-known cards consume review time that would be better spent on new or difficult material.

---

## 7. RTL and Script Considerations

### 7.1 Right-to-Left Language Support

Lingua provides consistent `dir="rtl"` rendering across all 21 tools for right-to-left scripts: **Arabic**, **Hebrew**, **Farsi (Persian)**, and **Urdu**. This includes:

- Bidirectional text layout in flashcards, reading views, and exercise prompts
- Correct cursor behavior and text alignment in input fields
- RTL-aware list and card layouts that mirror the standard left-to-right interface
- Proper rendering of mixed-direction content (e.g., Arabic text containing embedded English terms)

RTL support is not merely a cosmetic concern. Research on bilingual reading (Bentin & Ibrahim, 1996) shows that directional inconsistency between L1 and L2 creates cognitive overhead. When an Arabic-speaking learner encounters a flashcard where the Arabic text is rendered left-to-right due to a layout bug, the resulting processing difficulty is an *undesirable* difficulty -- one that impedes learning without strengthening memory. Proper RTL rendering removes this unnecessary processing burden.

### 7.2 Future: CJK Scripts

Chinese, Japanese, and Korean scripts present unique challenges beyond directionality that Lingua's architecture is being extended to address:

- **Character decomposition**: Kanji and Hanzi are composed of radicals that carry semantic and phonetic information. Radical-based learning (Heisig, 2011) offers a systematic approach to the challenge of memorizing thousands of characters. Future support will include radical decomposition views and stroke order animations.
- **Furigana/ruby text**: Japanese learners need phonetic annotations (furigana) above kanji characters. This requires ruby text rendering in all reading-oriented views.
- **Word segmentation**: Unlike alphabetic languages, Chinese and Japanese do not use spaces between words, requiring statistical or dictionary-based segmentation for tokenization in the Pre-Learn Pipeline.
- **Tone marking**: Mandarin Chinese uses four tones that distinguish otherwise identical syllables. Visual tone marking (pinyin with diacritics) and audio-based tone discrimination exercises are under consideration.

### 7.3 Bidirectional Text Handling

Mixed-script texts -- an Arabic text with embedded English terms, a Japanese text with romaji annotations, or a Hebrew text citing German sources -- require the Unicode Bidirectional Algorithm (UBA) for correct rendering. Lingua delegates this to browser-native bidi handling while ensuring that its own layout logic (flexbox directions, text alignment, margin/padding conventions) does not interfere with the algorithm's operation. The `isRTL()` utility function detects script directionality per language code and applies appropriate layout modifications throughout the component tree.

---

## 8. Privacy and Ethical Considerations in AI-Assisted Language Learning

### 8.1 Local-Only AI Processing

Lingua's AI features run entirely through **Ollama**, a local large language model runtime. No learner text, vocabulary data, or usage patterns are transmitted to external servers. This architecture provides several guarantees that are particularly significant in educational contexts:

- **Data sovereignty**: Learners retain complete ownership and control over their data. Vocabulary lists, review history, writing samples, and speaking transcripts remain on the learner's device.
- **No profiling**: Unlike cloud-based language apps, Lingua cannot build cross-user behavioral profiles or sell anonymized usage data. There is no advertising model, no engagement optimization loop, and no incentive to maximize screen time at the expense of learning efficiency.
- **Offline capability**: AI features function without internet connectivity, making the tool accessible in low-connectivity environments (rural schools, developing regions, in-flight study) and removing dependency on third-party service availability.
- **FERPA/GDPR compatibility**: Because no student data leaves the device, Lingua sidesteps the regulatory complexities that cloud-based educational technology must navigate.

### 8.2 Learner Data Sovereignty

Language learning data is inherently sensitive. Vocabulary choices can reveal religious background, political interests, medical conditions, and personal relationships. Writing samples may contain confessional content. Speaking practice recordings capture biometric voice data.

Lingua's local-first architecture means this data never leaves the learner's control. For institutional deployments via the Teacher Portal, data sharing is explicit and minimal: teachers see assignment completion rates and aggregate scores, not individual flashcard histories, writing samples, or speaking recordings.

### 8.3 Avoiding Bias in AI-Generated Content

AI-generated text -- stories, grammar exercises, example sentences, vocabulary definitions -- can reflect biases present in training data, including gender stereotypes, cultural assumptions, and Western-centric worldviews. In a language learning context, these biases can shape the learner's understanding of the target culture in harmful ways.

Lingua mitigates this through several mechanisms:

- **Model selection**: Ollama runs open-weight models (e.g., Llama 3.2) whose training data composition and known limitations are publicly documented, enabling informed assessment of potential biases.
- **Prompt design**: Generation prompts specify cultural neutrality, diversity in example scenarios, and avoidance of stereotypical associations (e.g., not defaulting to gendered occupational stereotypes in example sentences).
- **Human oversight**: Learners and teachers can review, edit, or reject AI-generated content before it enters the learning workflow. No AI-generated material is presented as authoritative without the opportunity for human review.
- **Transparency**: The system does not disguise AI-generated content as human-authored. Learners always know when they are interacting with generated material.

These measures do not eliminate bias entirely -- no current approach can -- but they make the system's limitations transparent and give users agency over the content they encounter.

---

## 9. References

Alderson, J. C. (2005). *Diagnosing foreign language proficiency: The interface between learning and assessment*. Continuum.

Baddeley, A. D. (2003). Working memory and language: An overview. *Journal of Communication Disorders*, 36(3), 189-208.

Bahrick, H. P. (1984). Semantic memory content in permastore: Fifty years of memory for Spanish learned in school. *Journal of Experimental Psychology: General*, 113(1), 1-29.

Bentin, S., & Ibrahim, R. (1996). New evidence for phonological processing during visual word recognition: The case of Arabic. *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 22(2), 309-323.

Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe & A. Shimamura (Eds.), *Metacognition: Knowing about knowing* (pp. 185-205). MIT Press.

Bjork, E. L., & Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In M. A. Gernsbacher et al. (Eds.), *Psychology and the real world* (pp. 56-64). Worth Publishers.

Black, P., & Wiliam, D. (1998). Assessment and classroom learning. *Assessment in Education*, 5(1), 7-74.

Council of Europe. (2001). *Common European Framework of Reference for Languages: Learning, teaching, assessment*. Cambridge University Press.

Council of Europe. (2020). *Common European Framework of Reference for Languages: Learning, teaching, assessment -- Companion volume*. Council of Europe Publishing.

Craik, F. I. M., & Lockhart, R. S. (1972). Levels of processing: A framework for memory research. *Journal of Verbal Learning and Verbal Behavior*, 11(6), 671-684.

Davis, P., & Rinvolucri, M. (1988). *Dictation: New methods, new possibilities*. Cambridge University Press.

Day, R. R., & Bamford, J. (1998). *Extensive reading in the second language classroom*. Cambridge University Press.

Deci, E. L., & Ryan, R. M. (2000). The "what" and "why" of goal pursuits: Human needs and the self-determination of behavior. *Psychological Inquiry*, 11(4), 227-268.

Ebbinghaus, H. (1885). *Uber das Gedachtnis: Untersuchungen zur experimentellen Psychologie*. Duncker & Humblot.

Elley, W. B., & Mangubhai, F. (1983). The impact of reading on second language learning. *Reading Research Quarterly*, 19(1), 53-67.

Ellis, R. (2001). Introduction: Investigating form-focused instruction. *Language Learning*, 51(s1), 1-46.

Flavell, J. H. (1979). Metacognition and cognitive monitoring: A new area of cognitive-developmental inquiry. *American Psychologist*, 34(10), 906-911.

Heisig, J. W. (2011). *Remembering the kanji* (6th ed.). University of Hawaii Press.

Hill, D. R. (2008). Graded readers in English. *ELT Journal*, 62(2), 184-204.

Horwitz, E. K., Horwitz, M. B., & Cope, J. (1986). Foreign language classroom anxiety. *The Modern Language Journal*, 70(2), 125-132.

Hu, M., & Nation, I. S. P. (2000). Unknown vocabulary density and reading comprehension. *Reading in a Foreign Language*, 13(1), 403-430.

Hulstijn, J. H. (2001). Intentional and incidental second language vocabulary learning: A reappraisal of elaboration, rehearsal and automaticity. In P. Robinson (Ed.), *Cognition and second language instruction* (pp. 258-286). Cambridge University Press.

Hulstijn, J. H., Hollander, M., & Greidanus, T. (1996). Incidental vocabulary learning by advanced foreign language students: The influence of marginal glosses, dictionary use, and reoccurrence of unknown words. *The Modern Language Journal*, 80(3), 327-339.

Krashen, S. D. (1985). *The input hypothesis: Issues and implications*. Longman.

Krashen, S. D. (2004). The case for narrow reading. *Language Magazine*, 3(5), 17-19.

Laufer, B. (1989). What percentage of text-lexis is essential for comprehension? In C. Lauren & M. Nordman (Eds.), *Special language: From humans thinking to thinking machines* (pp. 316-323). Multilingual Matters.

Laufer, B., & Nation, I. S. P. (1995). Vocabulary size and use: Lexical richness in L2 written production. *Applied Linguistics*, 16(3), 307-322.

Laufer, B., & Ravenhorst-Kalovski, G. C. (2010). Lexical threshold revisited: Lexical text coverage, learners' vocabulary size and reading comprehension. *Reading in a Foreign Language*, 22(1), 15-30.

Leitner, S. (1972). *So lernt man lernen: Der Weg zum Erfolg*. Herder.

Long, M. H. (1996). The role of the linguistic environment in second language acquisition. In W. C. Ritchie & T. K. Bhatia (Eds.), *Handbook of second language acquisition* (pp. 413-468). Academic Press.

Lyster, R., & Ranta, L. (1997). Corrective feedback and learner uptake: Negotiation of form in communicative classrooms. *Studies in Second Language Acquisition*, 19(1), 37-66.

Milton, J. (2009). *Measuring second language vocabulary acquisition*. Multilingual Matters.

Nakanishi, T. (2015). A meta-analysis of extensive reading research. *TESOL Quarterly*, 49(1), 6-37.

Nation, I. S. P. (2001). *Learning vocabulary in another language*. Cambridge University Press.

Nation, I. S. P. (2007). The four strands. *Innovation in Language Learning and Teaching*, 1(1), 2-13.

Nation, I. S. P. (2013). *Learning vocabulary in another language* (2nd ed.). Cambridge University Press.

Nation, I. S. P., & Waring, R. (2020). Teaching extensive reading in another language. *Reading in a Foreign Language*, 32(2), 168-198.

Norris, J. M., & Ortega, L. (2000). Effectiveness of L2 instruction: A research synthesis and quantitative meta-analysis. *Language Learning*, 50(3), 417-528.

Paivio, A. (1986). *Mental representations: A dual coding approach*. Oxford University Press.

Roediger, H. L., & Butler, A. C. (2011). The critical role of retrieval practice in long-term retention. *Trends in Cognitive Sciences*, 15(1), 20-27.

Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35(6), 481-498.

Schmitt, N. (2008). Instructed second language vocabulary learning. *Language Teaching Research*, 12(3), 329-363.

Swain, M. (1985). Communicative competence: Some roles of comprehensible input and comprehensible output in its development. In S. Gass & C. Madden (Eds.), *Input in second language acquisition* (pp. 235-253). Newbury House.

Swain, M. (1995). Three functions of output in second language learning. In G. Cook & B. Seidlhofer (Eds.), *Principle and practice in applied linguistics* (pp. 125-144). Oxford University Press.

Webb, S. (2007). The effects of context on incidental vocabulary learning. *Reading in a Foreign Language*, 19(2), 232-245.

Wozniak, P. A. (1990). *Optimization of repetition spacing in the practice of learning*. University of Technology in Poznan.

Ye, J. (2024). FSRS: A modern spaced repetition algorithm. Retrieved from https://github.com/open-spaced-repetition/fsrs4anki.

Yoshii, M. (2006). L1 and L2 glosses: Their effects on incidental vocabulary learning. *Language Learning & Technology*, 10(3), 85-101.
