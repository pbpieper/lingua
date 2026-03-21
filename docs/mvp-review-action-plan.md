# Lingua MVP Review — Action Plan

**Date:** 2026-03-21
**Source:** Founder walkthrough of full MVP

---

## 1. Navigation / Information Architecture Restructure

**Current:** Sidebar with Learn / Practice / Track categories listing 21+ tools
**Target:** Category-based navigation with tools nested under core pillars

### New Structure:
```
HOME
├── Today's Study Plan (daily tasks, split across day)
├── Word Bank (with in-bank upload, category sorting, custom study sessions)
├── Progress Overview (XP, streak, mastery summary)
└── Evening Review (end-of-day feedback loop)

PRACTICE (4 core categories + Games)
├── Reading
│   ├── Pre-Learn Pipeline (text analysis + word extraction)
│   ├── Stories (AI-generated graded readers)
│   ├── Sentence Cloze (contextual sentences)
│   └── Fill-in-the-Blank (story mode, sentence mode)
├── Writing
│   ├── Writing Practice (essays, prompts)
│   ├── Phrases (situational dialogue prep)
│   └── Fill-in-the-Blank (typing mode)
├── Speaking
│   ├── Conversation (AI chat — crosses all categories)
│   ├── Pronunciation Drill (word-by-word with audio)
│   └── Dialogue Practice (witness + learn from dialogues)
├── Listening
│   ├── Listening Practice (dictation, comprehension)
│   └── Conversation (listening side)
└── Games
    ├── Match (memory, column-match, image-match, synonym/antonym)
    ├── Quiz (multiple choice, bidirectional, typing, speaking)
    ├── Flashcards (visual, typing, pronunciation, writing)
    └── [Future games]

TRACK
├── Dashboard (stats, heatmap, accuracy)
├── Universe (vocabulary galaxy visualization)
├── Achievements (badges, mastery levels, XP milestones)
└── Grammar (lessons, units, conjugation drills)

SOCIAL
├── Teacher Portal (class management, assignments, units)
├── Community (leaderboards, challenges, friends)
└── Profile (settings, onboarding data, preferences)
```

### Key Principles:
- Tools can appear in multiple categories (conversation → speaking + listening + reading + writing)
- Pre-learn is both an upload mechanism AND a reading tool
- Upload lives WITHIN Word Bank, not as a separate top-level item
- Home should not overwhelm — progressive disclosure still applies

---

## 2. Daily Study Plan / Session System Overhaul

### Current Problem:
- "Start Today's Session" just opens flashcards
- No mandatory categories
- Single-session design (sit down for 15 min)

### Target Design:

**Daily Session = Multiple micro-tasks across categories:**
- Each day has MANDATORY categories: Reading, Writing, Speaking, Listening
- Categories vary day-to-day (not same every day)
- Tasks are completable throughout the day (not one sitting)
- Each category has a task using different tools (varies to stay interactive)
- Completing all categories = full streak for the day

**New Word Integration:**
- Daily target for new words (e.g., 30/day)
- If user uploads 100 words → 30/30/30/10 over 4 days
- On day 4 with only 10 new: prompt user to find more (chat feature)
- "Do you want more words in the same category or switch topics?"
- New word lifecycle: introduction → visual/audio → context sentences → practice → mastery

**Level-Adaptive Sessions:**
- A1 beginner: more flashcards, images, simple matching, short sentences
- C1 advanced: full paragraphs, essays, nuanced grammar, complex fill-in-blank
- Time-based: sessions sized to user's daily time commitment

**Evening Review / Feedback Loop:**
- After completing all daily tasks → "Well done" screen
- Quick feedback: right number of new words? liked the tools? want different practice methods? interested in current topic?
- Chat with AI tutor to assess where you're at
- Feedback guides TOMORROW's session plan
- User can also edit today's plan day-of

---

## 3. Word Bank Enhancements

### Current Issues:
- Can't interact with/expand existing lists
- Upload is separate from Word Bank
- No category sorting
- No custom study sessions

### Target Features:
- **In-bank upload:** Upload button within Word Bank itself
- **Expandable lists:** Add words to existing lists anytime
- **Category tags:** animals, travel, business, family, kitchen, etc.
- **Smart sorting:** Sort all vocab by: category, frequency tier (core 1000 vs niche), grammar type, mastery level, CEFR level
- **Search/filter:** "Show me all animals" → see count, add more
- **Custom study sessions:** Select words from bank → "Custom Study" → choose any tool → words pre-loaded
- **Word morphology tracking:** Track verb conjugations, noun forms, root relationships (especially Arabic). Don't create separate entries per form, but track exposure to different forms
- **Universe integration:** Tags feed into galaxy visualization

---

## 4. Tool Variables & Variations

**PRINCIPLE: Every tool has configurable Variables (difficulty, size, settings) and multiple Variations (game modes).**

### Match Game
**Variables:** Grid size, difficulty, time limit
**Variations:**
1. Memory (current — flip cards to find pairs)
2. Column matching (left column ↔ right column, draw lines)
3. Image matching (image ↔ word)
4. Description matching (definition in target language ↔ word)
5. Synonym matching
6. Antonym matching

### Fill-in-the-Blank
**Variables:** Word bank visible vs typing, hint availability, difficulty
**Variations:**
1. Story mode (full paragraph with blanks)
2. Sentence mode (individual sentences)
3. Read-then-fill (read story first, then blanks appear)
4. Word bank selection (click correct word from options)
5. Typing mode (type the word yourself)

### Flashcards
**Variables:** Card count, review mode (recognition vs production)
**Variations:**
1. Visual flashcard (word ↔ translation, flip)
2. Typing mode (see word, type translation)
3. Pronunciation mode (see word, speak it, system checks)
4. Writing mode (pen input / handwriting recognition)
5. Image flashcard (image ↔ word)
6. Always accessible beyond daily quota

### Quiz / Multiple Choice
**Variables:** Number of options, timer, difficulty
**Variations:**
1. Target → Native (current: Arabic word, choose English)
2. Native → Target (English word, choose Arabic)
3. Audio quiz (hear word, choose meaning)
4. Typing quiz (see definition, type word)
5. Speaking quiz (see word, pronounce it)

### Reading
**Variables:** Text length, % unknown words, CEFR level
**Variations:**
1. AI-generated story with word integration
2. Upload your own text (pre-learn)
3. Click unknown words to get translation + add to bank
4. Comprehension questions after reading

### Conversation
**Variables:** Topic, formality level, speed
**Variations:**
1. Free chat with AI
2. Guided dialogue (role-play scenarios)
3. Dialogue witness mode (watch/read a conversation, learn from it)
4. Cross-category: counts toward speaking + listening + reading + writing

---

## 5. Virtual Keyboard for Non-Latin Scripts

- On-screen keyboard for Arabic, Japanese, Korean, Chinese, Russian, etc.
- Toggle-able (user can show/hide)
- Click letters to spell words
- Essential for quiz, fill-in-blank, typing exercises
- Reduces friction for learners who don't have native keyboard installed

---

## 6. XP / Gamification System

### XP Sources:
- Completing daily tasks
- Going beyond daily requirements (bonus XP)
- Streaks (daily multiplier)
- Mastery milestones (mastering a word = XP)
- Achievement unlocks

### Gamification Elements:
- **XP counter:** Visible on home screen
- **Mastery levels per word:** Not just "known/unknown" but progressive mastery
- **Achievements:** No cap — engaging from bronze to top tier (like Clash of Clans / League of Legends ranking)
- **Badges:** Earnable and displayable
- **Coins/currency:** Earned through XP, used to customize universe/avatar
- **Avatar system (future):** Build your world as you learn
- **Universe customization:** XP/coins unlock visual customizations for vocabulary galaxy
- **Progressive unlocking:** New tool variations unlock with progress

---

## 7. Unit / Journey System

- Visual progression trail (like Candy Crush / Duolingo path but NOT rigid)
- Units combine: new vocabulary + new grammar + exercises
- Example: Unit 1 = present tense + 50 words → Unit 2 = past tense + same words in past tense + 50 new words
- Checkpoints visible on the trail
- Teachers can create/assign units
- Units can come from textbook alignment

---

## 8. Language & Content Fixes

- Fix language mixing (sentences appearing in wrong language)
- Bidirectional exercises (target↔native in all tools)
- Multi-language user handling (learning multiple languages)
- Age-appropriate content filtering based on profile
- Native speaker consideration (can still develop vocabulary in own language)
- Grammar tool: add internal validation/checking layer for AI outputs

---

## 9. Teacher / Enterprise Integration

- Teachers set daily routines for students
- Assignment tracker with deadlines
- Students interact in their own environment but see teacher-assigned content
- Toggle between teacher/student views
- Units created by teachers feed into student journeys
- Class vocabulary lists visible to students but studied in personal environment

---

## 10. Community Enhancements

- Challenge friends (like Duolingo)
- Build streaks together
- Share achievements
- Leaderboards by: XP, mastery, streak
- Game-based challenges (timed match, etc.)

---

## 11. Onboarding Improvements

- Day 1: Don't overwhelm. Start with a short poem/sentence
- Show known vs unknown words in that sentence
- Next day: learn the unknowns → user understands the sentence
- Build confidence through visible progress
- Profile data: age, goals, learning context (student, professional, diplomat, soldier)
- System uses profile to personalize content and difficulty

---

## Implementation Priority

### Phase 1 (This Sprint) — Core Architecture
1. Navigation restructure (category-based)
2. Daily session system with mandatory categories
3. Word Bank enhancements (in-bank upload, custom study sessions, category tags)
4. XP system foundation
5. Fix language mixing bugs

### Phase 2 — Tool Enhancements
6. Match game variations (column matching, image matching)
7. Fill-in-blank variations (story mode, word bank selection)
8. Quiz bidirectional + typing mode
9. Flashcard pronunciation + writing modes
10. Virtual keyboard for non-Latin scripts

### Phase 3 — Engagement
11. Evening review feedback loop
12. Unit/journey trail system
13. Achievement expansion (no cap, ranking system)
14. Universe customization with XP/coins

### Phase 4 — Social/Enterprise
15. Teacher unit creation + assignment
16. Community challenges + friend interactions
17. Profile depth + content filtering
18. GitHub + multi-user auth
