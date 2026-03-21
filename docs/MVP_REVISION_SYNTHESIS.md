# Lingua MVP walkthrough — synthesized revision brief

**Source:** Top-to-bottom product notes (home → tools → track).  
**Goal:** Nothing from the walkthrough is “unchecked”; this doc is the single checklist for holistic revision.

---

## 1. Information architecture & navigation

| Topic | Current pain / intent | Revision direction |
|--------|------------------------|-------------------|
| **Learn vs Practice vs Home** | “Categories under Learn should be under Home”; Word Bank belongs on Home; Upload inside Word Bank; Flashcards = Practice; Pre-learn straddles upload + reading. | **Re-home IA:** Home = daily plan + entry to Word Bank (with embedded upload) + light “get started”. **Practice** = full toolbox, always available (not gated by “today’s queue”). **Learn** sidebar grouping may collapse or map to Home sub-areas + Practice hubs. |
| **Left bar vs Home** | Clean sidebar, but should align with “native” home: bottom or sections for **Today’s study plan** (click-through tasks) vs **Practice** (Reading / Writing / Speaking / Listening / Vocab / Grammar → tools). | **Two mental models:** (A) **Session** = prescribed daily tasks. (B) **Practice** = exploratory, all tools. Reflect in nav + home layout. |
| **Pre-learn placement** | Upload path + reading assistant; not only “learn” tab. | Treat as: **Word Bank → ingest text** + **Reading → pre-learn mode**; same engine, two entry points. |

---

## 2. Home & daily experience

| Topic | Notes | Revision direction |
|--------|--------|-------------------|
| **What’s working** | Welcome, streak, date, search, light/dark — strong and clear. | Preserve; polish only. |
| **“X words known of Y total”** | Vision understood; progress display can better show **mastery / lifecycle**, not just counts. | Progress UI: layers for *new / learning / reviewing / mastered*, optional CEFR, streak contribution — not only numerator/denominator. |
| **“Start today’s session”** | Today jumps to flashcards; **SR gives zero cards** → dead end. | **Session router:** never land on empty tool; fallback = pick another modality or “introduce new words” flow. |
| **Session vs Practice** | Practice = **all** games/tools anytime. Session = **tailored** click-through **mandatory categories** (reading, writing, listening, speaking — mix varies by day). | Implement **DailySessionPlan** model: categories + optional tool choices per category + completion rules for streak. |
| **Streak / full day** | Completing the day = hit each category (not one 15-min blob). | **Granular tasks:** multiple completions per day; allow spread across the day; still allow “do all now”. |
| **New words per day** | Target (e.g. 30/day) with bank > daily → drip over days; day 4 might be 10 new + “where do the other 20 come from?” | **Queue math** + **UX:** show remaining new-word budget, offer **same theme / shift category / “house rooms”** (animals, kitchen, work…). Tie to **chat/tutor** nudges. |
| **Vocab lifecycle** | New word intake (Duolingo/Quizlet/Rosetta-style) → then **see in varied contexts** (grammar, sentences, use cases). | Model **stages**: introduced → recognized → productive → contextualized; session generator uses stage + level. |
| **Level-aware sessions** | A1 can’t read full paragraph; C1 shouldn’t grind 100 isolated flashcards if a reading could cover them. | **Session templates by CEFR + time budget:** weight reading/listening vs drill; parameterize length/density. |
| **End-of-day feedback** | Prefer **evening** reflection after success (not morning planning): “30 was too many → 20 tomorrow”, tool preferences, topic interest. | **Session debrief** modal: quick taps + optional free text/voice **tutor**; writes to **tomorrow’s plan** + settings. |
| **Morning vs evening** | User can still edit plan same day; default nudge = post-session. | Settings: debrief reminders; plan overrides. |

---

## 3. Practice tools — global rules

| Rule | Detail |
|------|--------|
| **Variables** | Per tool: difficulty, set size, % known/unknown, direction (L1↔L2), hints on/off, timer, etc. — **easy UI toggles**, not “hidden backend”. |
| **Variations** | Same tool, different **modes** (e.g. Match: memory vs connect pairs; image vs synonym vs definition-in-target-language). |
| **Always available** | Meeting “today’s flashcard quota” must **not** block free practice. |
| **Custom study session** | From Word Bank: select words/lists → **any tool** opens scoped to that set (match, fill-blank, reading story, etc.). |
| **Unlocking** | Advanced variations unlock by **progress** (XP, mastery, word count) — optional gamified gate. |

---

## 4. Tool-by-tool feedback (from walkthrough)

### 4.1 Quiz (multiple choice)

- **Weak spot:** drifts toward **visual recognition** only; needs **productive** checks.
- **Expand:** **bidirectional** (L2→L1 and L1→L2); add **typing**, **speaking** (when backend allows), **spelling**.
- **Distinction:** Quiz = **test**; flashcards = **study** (see flashcards section).
- **Today’s tasks:** Quiz alone shouldn’t stand in for a “complete” daily set — belongs inside a **balanced session**.

### 4.2 Flashcards

- True flashcards = **A/B sides**, multiple interaction modes (flip, type, **speak to flip** — aspirational with better backend / device APIs).
- Current **fill-in-blank that types one word** overlaps flashcards — **clarify product boundaries** (typing drill vs cloze-in-story).

### 4.3 Fill in the blank

- **Not** only “type the lemma”; prefer **story/sentence** with blanks; modes: read full then blank; blanks visible from start; **pick from word bank** vs **type**; tie to **today’s 30** or custom set.
- **Bi-directional integration** with Reading (generate text with targets) vs Cloze (practice).

### 4.4 Match / memory

- **Variables:** grid size, pair count.
- **Variations:** memory flip vs static “draw lines”; **images**; **definitions in L2** for advanced; **synonyms/antonyms** when data supports.
- **Games bucket:** may sit under a **Games** practice category as well as under Vocab.

### 4.5 Reading / Pre-learn / Stories / Cloze

- **Pre-learn:** simplify **per-text language UI** vs **global profile** (native + target); multi-learner and multi-L1 needs a **single source of truth** for “UI language”, “hint language”, “target”.
- **Bugs called out:** hints/sentences **wrong language** (e.g. German hint for Arabic study); cloze asking for English in an Arabic slot — **consistency layer** in content generation + UI.
- **Native keyboard** for typing Arabic etc. — **toggleable on-screen keyboard** across writing/quiz/cloze.
- **Stories:** prefer **tap unknown → add to bank + explanation** over only “hide unknown”; **% new words** and difficulty beyond easy/medium/hard; comprehension check — **keep and expand**.
- **Reading options:** multiple sentences per word vs one text integrating many targets; integrate with fill-blank.

### 4.6 Speaking / conversation

- **Conversation** = cross-cutting (speaking + writing + reading + listening).
- **Speaking section** = pronunciation + conversation together, with **language selection** fixed (was missing).
- **Pronunciation** tied to **new-word lifecycle** (see/hear/visual per word); research question: **discover first vs see first** — configurable by level/preference.

### 4.7 Listening & writing

- Implied: fit under **practice categories**; same variable/variation pattern; keyboard/speak where relevant.

### 4.8 Grammar

- **Strong concept, rough execution** — mistakes, hints that **give away** answers; needs **deep dive** + **self-check** pass on generated content.
- **Units / curriculum:** orgs (teacher/school) assign **ordered units** (present with vocab set → later past with same lemmas) — aligns with **path / journey** (Duolingo-like trail without same rigidity).

### 4.9 Phrases

- Good scenario format (e.g. travel/airport); **language consistency** bugs (Arabic selected, Spanish snippets); treat as **writing/speaking context** tool; **keep dialogue practice** — “don’t lose it”.

---

## 5. Word bank, lists & “universe”

| Topic | Direction |
|--------|-----------|
| **Lists** | Not one-shot upload: **multiple lists** (class, self-study, tutor…), **editable**, **grow over time**. |
| **Upload** | **Inside Word Bank** (global Upload nav may remain as shortcut). |
| **Universe** | **Network view:** lemmas linked by meaning, grammar, register (core 1000 vs niche), topic “rooms”; **sort/filter/tag** across *all* vocab; query “show animals” → count → add to list / session. |
| **Stats columns** | After lemmas, track **forms** (sg/pl, verb conjugations, Arabic roots/patterns) without necessarily **one card per surface form** — **lemma + form exposure** analytics. |

---

## 6. Onboarding & cognitive load

- **Don’t force big upload day 1:** demo with **short poem / long sentence** → “words you know vs missing” → next day learn → sentence unlocks.
- **Unlock features** gradually (variations, not core access) by level/progress.

---

## 7. Profile, safety & personalization

- **Rich internal profile:** age band, context (child vs soldier vs diplomat) → **content safety** and **vocab domains**.
- **System uses profile** for generation defaults (topics, tone, difficulty).

---

## 8. Gamification: XP, mastery, achievements, meta

| Topic | Direction |
|--------|-----------|
| **XP** | From **daily tasks**, **extra practice**, creation (lists, reading upload?), streaks — define formula later. |
| **Mastery** | Per word/grammar/skill; feeds session selection. |
| **Achievements** | **No low ceiling** — engaging from beginner through advanced (LoL/Clash-style long tail). |
| **Home surfacing** | XP/badges **visible but not overwhelming** on Home. |
| **Future:** coins, **avatar/base**, **metaverse** world tied to universe — document as **phase 2+**. |

---

## 9. Teacher, community, enterprise

| Topic | Direction |
|--------|-----------|
| **Teacher portal** | Not everyone is a teacher; **role toggle**; students **enroll** in courses; teacher sets **daily routine / assignments**; **lists** visible in student app; **deadlines**, sign-off, EdTech patterns (tracker, LMS-lite). |
| **Enterprise** | Industry/org mode: teacher vs student “world” + integration with personal Home (toggle or merged views). |
| **Community** | Leaderboards (XP, mastery), **records** per game, **challenges**, **friend streaks**, social — spec later; align with fair-play and privacy. |

---

## 10. Technical / product enablers (cross-cutting)

1. **Session engine:** plans, categories, tool routing, empty-state fallbacks, streak rules.  
2. **Word-set context:** `activeStudySet` (today’s words, custom selection, list id) passed into all tools.  
3. **Language consistency:** single config for target/native/hint/generation UI language; QA checklist for mixed-language bugs.  
4. **Content QA:** grammar/story/cloze **validator** step (internal filter) before show.  
5. **On-screen keyboard** component shared across tools.  
6. **Tutor/chat** hook for nudges (extra words, category shift) — can stub with rules before full LLM.

---

## 11. Actor map (who “cares” about what)

| Actor | Primary concerns |
|--------|------------------|
| **Learner (casual)** | Low friction, today’s plan, streak, mobile-friendly chunks. |
| **Learner (power)** | Custom sessions, variables/variations, universe, stats by lemma/form. |
| **Teacher / org** | Units, assignments, lists, deadlines, visibility into student progress. |
| **System (product)** | Session generation, XP/mastery, unlock rules, content safety. |
| **Content / AI pipeline** | Language consistency, hints, difficulty, self-check. |

---

## 12. Holistic success criteria

- **Session path never dead-ends** (empty flashcards → alternate task).  
- **Practice path always full toolbox** + custom word sets.  
- **One vocabulary model** powers lists, universe, sessions, and tools.  
- **IA matches mental model:** Home = day + bank entry; Practice = explore by skill category.  
- **Every tool** documents **variables + variations** in UI; advanced modes unlock cleanly.  
- **End-of-day debrief** shapes **next day** without mandatory morning planning.  
- **Multi-language/L1** behavior is **consistent and testable**.

---

*Next step: execute via parallel workstreams in `AGENT_WORKSTREAMS.md`.*
