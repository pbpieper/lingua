# Parallel agents — holistic Lingua revision

Use this file to spin up **separate Cursor chats / Composer sessions / human owners** per stream. Each stream has **scope**, **dependencies**, **deliverables**, and **definition of done**.

**Ground rules for all agents**

- Read `docs/MVP_REVISION_SYNTHESIS.md` first; treat it as source of truth.
- Prefer small PR-sized commits; don’t break `npm run build`.
- New UX: add **empty states** and **loading**; no silent failures.
- When touching AI/copy, note **language triple** (UI / hints / target) in code comments or types.

---

## Agent A — Information architecture & navigation

**Scope:** Sidebar, `TOOLS` in `src/types/tools.ts`, `AppShell.tsx`, `Sidebar.tsx`, Home layout (sections for “Today” vs “Practice”).  
**Goal:** Home contains Word Bank entry + embedded upload affordance; Practice grouped by **Reading / Writing / Speaking / Listening / Vocabulary / Grammar / Games** (exact labels TBD); remove duplicate “learn” confusion.

**Deliverables**

- Proposed **nav map** (markdown in `docs/ia-nav-proposal.md`).
- Code changes: reorder categories, optional nested routes or home “hub” cards.

**Definition of done**

- No tool is only reachable from a misleading category; Upload reachable from Word Bank **and** optional top-level shortcut if kept.

**Depends on:** None (can start immediately).  
**Coordinates with:** B (session router may add new home widgets).

---

## Agent B — Daily session engine & streak logic

**Scope:** `DailyReview.tsx`, progress/session types (`src/types/word.ts` or new `session.ts`), `vocabApi` if persistence needed.  
**Goal:** **Session vs practice** separation: “Start today’s session” opens a **guided flow** (category checklist), not a single tool. **Mandatory categories** vary by day (R/W/L/S + new words). **Empty SR deck** → fallback task (e.g. “Learn 5 new words”, “Listening”, etc.). Multi-step completion across the day.

**Deliverables**

- Types: `DailySessionPlan`, `SessionTask`, `SessionCategory`, completion rules.
- UI: task list on Home; router screen or modal flow; streak only when categories satisfied (configurable).

**Definition of done**

- User never lands on “0 flashcards” as the only path; streak rules documented in code comments.

**Depends on:** None for MVP logic; **C** for passing word sets into tools.  
**Coordinates with:** D (debrief writes tomorrow’s plan).

---

## Agent C — Shared “study set” context

**Scope:** `AppContext.tsx`, tool entry props or query params, Word Bank selection UI.  
**Goal:** User selects words/lists → **activeStudySet** (ids + metadata) → all practice tools can consume same set (match, quiz, fill-blank, story generator params, etc.).

**Deliverables**

- `StudySetContext` or extend `AppContext` with `activeSet`, `setActiveSet`, `clearActiveSet`.
- Word Bank: “Start custom session” → choose tools or go to hub.

**Definition of done**

- At least **3 tools** read the same set without re-uploading (e.g. match, multichoice, fillblank).

**Depends on:** None.  
**Coordinates with:** B, E, F.

---

## Agent D — End-of-day debrief & adaptive tomorrow

**Scope:** New component + persistence (`localStorage` or API).  
**Goal:** After “day complete”, **quick survey** (word count OK?, tools OK?, topic interest?) + optional tutor text/voice stub; persists **preferences** that **Agent B** reads when building tomorrow’s plan.

**Deliverables**

- `SessionDebrief.tsx`, schema for answers, hook `useDailyPreferences`.

**Definition of done**

- Completing debrief changes next day’s default new-word count or category weights (even if rule-based stub).

**Depends on:** B (plan builder should read prefs).  
**Coordinates with:** H (XP “day complete” bonus).

---

## Agent E — Tool variables & variations (framework + 2 pilots)

**Scope:** Shared `ToolOptions` UI pattern; pilot on **Match** + **Fill blank** (or Match + Quiz).  
**Goal:** Document per-tool **variables** (size, direction, hints) and **variations** (memory vs connect; story cloze vs single sentence). **Easy toggles** in tool chrome.

**Deliverables**

- Small design note in `docs/tool-variables-matrix.md`.
- Implement for 2 tools end-to-end; pattern for others.

**Definition of done**

- Users can switch modes without page reload; state survives session (localStorage optional).

**Depends on:** C for custom sets (optional but ideal).  
**Coordinates with:** F.

---

## Agent F — Quiz & flashcards product split + bidirectional

**Scope:** `FlashcardDeck.tsx`, `MultipleChoice.tsx`, overlap with `FillBlank.tsx`.  
**Goal:** Quiz: **L2→L1 and L1→L2**; optional typing path; clarify **flashcard = study, quiz = test**. Reduce “pure visual guess” where possible.

**Deliverables**

- Mode enum in UI; consistent copy; types for `QuizDirection`.

**Definition of done**

- Both directions work with same `activeStudySet`; flashcards don’t claim to “prove” mastery in copy.

**Depends on:** C recommended.  
**Coordinates with:** E.

---

## Agent G — Language consistency & on-screen keyboard

**Scope:** Reading, Stories, Cloze, Grammar, Phrases, Pre-learn — generation prompts and display.  
**Goal:** Fix **wrong-language hints** and **wrong-language prompts**; centralize **native / target / hint** locale; add **toggleable on-screen keyboard** for target script.

**Deliverables**

- `useLearningLocales()` or extend context: `{ uiLocale, nativeLocale, targetLocale, hintLocale }`.
- Shared `VirtualKeyboard` or OS-friendly fallback component.

**Definition of done**

- Repro cases from notes (German hints during Arabic study) **impossible** by construction or caught by dev assert in dev mode.

**Depends on:** None.  
**Coordinates with:** All AI-facing tools.

---

## Agent H — XP, mastery, achievements surfacing

**Scope:** Achievements, dashboard, home widgets.  
**Goal:** XP for **session complete** + **extra practice**; mastery hooks stubbed or wired to existing stats; achievements **scalable** tiers; home **badge strip** subtle.

**Deliverables**

- `docs/xp-mastery-v1.md` with formula v0.
- Minimal implementation + TODO for backend.

**Definition of done**

- Completing daily session increments XP; going beyond still rewards.

**Depends on:** B for “session complete” event.  
**Coordinates with:** D.

---

## Agent I — Word bank & lists v2

**Scope:** Word Bank UI, upload inside bank, list CRUD, universe entry points.  
**Goal:** Multiple lists, edit/grow, **custom study** from selection; link to universe filters (phase 1: tags/topics if data exists).

**Deliverables**

- List model + UI; upload embedded in bank.

**Definition of done**

- User can have ≥2 lists and add words to an existing list after first upload.

**Depends on:** C for “study selected”.  
**Coordinates with:** J.

---

## Agent J — Universe & lemma/form stats (discovery + MVP)

**Scope:** `VocabUniverse`, stats in Word Bank, types for lemma vs forms.  
**Goal:** Document **linguistic model** (lemma + exposures by form); MVP: filters/tags + “query by topic” stub; long-term network graph.

**Deliverables**

- `docs/universe-data-model.md`.
- UI increment: topic filter or tag chips if data pipeline allows.

**Definition of done**

- Data model documented even if UI is minimal; no contradiction with “one card per lemma” product rule.

**Depends on:** I.  
**Coordinates with:** C.

---

## Agent K — Teacher portal & community (spec + thin vertical slice)

**Scope:** `TeacherPortal.tsx`, `Community.tsx`.  
**Goal:** **Spec first** (courses, enroll, assignments, deadlines); implement **one vertical slice** (e.g. teacher creates list → student sees it) if API exists; otherwise mock + types.

**Deliverables**

- `docs/edtech-teacher-community-spec.md`.
- Optional: local-only demo flow.

**Definition of done**

- Clear roadmap; no fake “done” without data model.

**Depends on:** I for lists.  
**Coordinates with:** Product.

---

## Agent L — Onboarding gentle path & unlock rules

**Scope:** `Onboarding`, `Walkthrough`, first-run Home.  
**Goal:** Day 1 **demo sentence/poem** path; progressive **unlock** of advanced tool variations (ties to E, H).

**Deliverables**

- Revised onboarding steps + feature flags by `userLevel` / word count.

**Definition of done**

- New user isn’t pushed to bulk upload before value demo.

**Depends on:** None.  
**Coordinates with:** E, H.

---

## Suggested execution order (parallel waves)

| Wave | Agents |
|------|--------|
| **1** | A, C, G (IA, study set, locale/keyboard) |
| **2** | B, D, I (session, debrief, lists) |
| **3** | E, F, H (tool modes, quiz/flash split, XP) |
| **4** | J, K, L (universe, edtech spec, onboarding) |

---

## Cursor usage tip

Open **one Composer/chat per agent letter** with prompt:

> Read `lingua/docs/MVP_REVISION_SYNTHESIS.md` and `lingua/docs/AGENT_WORKSTREAMS.md`. Implement **Agent X** only. Touch only the files in scope; summarize changes and list follow-ups for dependent agents.

This keeps work **holistic** (shared synthesis) while execution stays **parallel and mergeable**.

---

## Landed in codebase (cohesive spine)

- **B + client layer:** `clientStore.ts`, `dailySessionPlan.ts`, `types/session.ts` — daily plan persistence, debrief prefs, balanced session steps (no empty-SRS dead end).
- **C:** `AppContext` active study set + `ActiveStudyBanner` — Word Bank “Practice selection” + flashcards/match/quiz/fill-blank respect the set.
- **A (partial):** Sidebar **Words** group (`vocab` category); flashcards under **Practice**.
- **D (MVP):** `SessionDebrief` after full plan completion; adjusts `targetNewWordsPerDay` in `lingua-learning-prefs`.
- **F (partial):** Quiz **forward / reverse** modes in `MultipleChoice.tsx`.
- **I (partial):** Word Bank **Add / import** CTA + list chips set `currentListId` before opening the bank.

### Wave 1 (2026-03-21)

- **A (complete):** IA restructured — sidebar now has Practice sub-groups (Reading/Writing/Speaking/Listening/Vocabulary/Grammar/Games); Home/Word Bank/Upload as top-level main tools; `PracticeGroup` type + `PRACTICE_GROUPS` config. See `docs/ia-nav-proposal.md`.
- **E (complete):** Variables & variations framework — `ToolVariable`/`ToolVariation` types in `types/toolConfig.ts`; `ToolOptionsBar` shared component; Match game (memory vs column connect + pair count/direction/timer); Fill Blank (sentence vs word bank + item count/hints). See `docs/tool-variables-matrix.md`.
- **G (partial):** `useLearningLocales()` hook centralizing locale config; `VirtualKeyboard` + `ToggleableKeyboard` components for Arabic/Russian/Japanese/Korean/Chinese; keyboard integrated into FillBlank. Still needs: audit all AI-facing tools to use centralized locales.

Remaining synthesis items (grammar QA, full locale audit, teacher vertical slice, session engine completion, etc.) are future agents.
