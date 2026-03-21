# Information Architecture & Navigation — Implemented

## Sidebar Structure (new)

```
Lingua (brand)
├── Home            ← daily plan, progress, welcome
├── Word Bank       ← browse/manage vocab, embedded upload
├── Upload          ← quick shortcut (also reachable from Word Bank)
│
├─ PRACTICE ─────────────────────
│  ├─ Reading
│  │  ├── Reading        (interactive text)
│  │  ├── Pre-Learn      (text ingest + unknown word finder)
│  │  └── Stories        (AI-generated graded reading)
│  ├─ Writing
│  │  ├── Writing        (AI correction)
│  │  └── Phrases        (scenario dialogue)
│  ├─ Speaking
│  │  └── Speaking       (pronunciation + conversation)
│  ├─ Listening
│  │  └── Listening      (dictation)
│  ├─ Vocabulary
│  │  ├── Flashcards     (spaced repetition)
│  │  ├── Quiz           (multiple choice)
│  │  ├── Fill Blank     (cloze)
│  │  └── Sentence Cloze (context sentences)
│  ├─ Grammar
│  │  └── Grammar        (lessons + exercises)
│  └─ Games
│     └── Match          (memory / column connect)
│
├─ TRACK ────────────────────────
│  ├── Universe      (vocabulary galaxy)
│  ├── Teacher       (classes & assignments)
│  ├── Community     (leaderboard, friends)
│  ├── Achievements  (badges, XP)
│  ├── Progress      (dashboard)
│  └── Settings      (profile & preferences)
│
└── [Show all tools] toggle
```

## Key Decisions

1. **Home + Word Bank + Upload** are top-level "main" tools — always visible, no group header needed
2. **Practice** is subdivided by skill category (Reading/Writing/Speaking/Listening/Vocabulary/Grammar/Games) — maps to the mental model of "which skill am I working on?"
3. **Pre-Learn** lives under Reading (it's a text-ingest tool that leads to reading practice) — no longer under a separate "Words" group
4. **Upload** remains as a top-level shortcut AND is accessible from within Word Bank
5. **Track** retains Universe, Teacher, Community, Achievements, Progress, Settings

## Changes Made

- `src/types/tools.ts` — Added `PracticeGroup` type, `practiceGroup` field on `ToolDef`, `PRACTICE_GROUPS` config array. Recategorized Upload and Pre-Learn.
- `src/components/layout/Sidebar.tsx` — Groups now render practice sub-groups under a "Practice" heading. Main tools (Home, Word Bank, Upload) render ungrouped at top.
