# Lingua Developer Guide

Comprehensive technical reference for developers contributing to, extending, or deploying Lingua — a vocabulary learning platform built with Vite, React 19, TypeScript, and Tailwind v4.

### Product revision & parallel work

- **Full MVP walkthrough synthesis (checklist):** [`docs/MVP_REVISION_SYNTHESIS.md`](./MVP_REVISION_SYNTHESIS.md)
- **Agent workstreams (scoped tasks for separate chats / owners):** [`docs/AGENT_WORKSTREAMS.md`](./AGENT_WORKSTREAMS.md)

---

## Architecture Overview

Lingua is a single-page application with a local AI backend:

- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS v4
- **Backend**: Creative Hub (FastAPI + SQLite at `localhost:8420`)
- **AI**: Ollama for local LLM inference (`localhost:11434`, model: `llama3.2:3b`)
- **TTS**: Coqui TTS via Creative Hub for pronunciation audio

### Key Architectural Principles

1. **Service layer pattern** — Components never call APIs directly. All backend communication goes through `src/services/vocabApi.ts`, consumed via the `useApp()` hook or direct imports.
2. **Code splitting** — Every tool component is lazy-loaded with `React.lazy()` + `Suspense`, keeping the initial bundle small.
3. **CSS custom properties** — All colors use `var(--color-*)` tokens defined in `index.css`. No hardcoded colors.
4. **No external state library** — State management uses React Context + hooks + localStorage for preferences.

### System Diagram

```
Browser (localhost:5174)
  └── React SPA
        ├── vocabApi.ts ──────► Creative Hub API (localhost:8420)
        │                           ├── SQLite (hub.db)
        │                           ├── Ollama (localhost:11434)
        │                           └── Coqui TTS
        └── localStorage
              ├── lingua-preferences
              ├── lingua-onboarding
              └── lingua-user-id
```

---

## Project Structure

```
lingua/
├── docs/                          # Documentation
├── public/                        # Static assets served by Vite
├── src/
│   ├── main.tsx                   # Entry point — renders <App /> into #root
│   ├── App.tsx                    # Provider stack: ThemeProvider → AppProvider → AppShell
│   ├── index.css                  # Tailwind v4 import + CSS custom property tokens (light/dark)
│   │
│   ├── types/
│   │   ├── tools.ts               # LinguaToolId union type, ToolDef interface, TOOLS array
│   │   └── word.ts                # Word, WordInput, ReviewResult, VocabList, VocabSession, VocabStats
│   │
│   ├── design/
│   │   ├── tokens.ts              # Color constants as a TypeScript object (used for JS-side color access)
│   │   └── theme.tsx              # ThemeProvider + useTheme() — dark mode via .dark class on <html>
│   │
│   ├── services/
│   │   └── vocabApi.ts            # Full API client — typed functions for all backend endpoints
│   │
│   ├── context/
│   │   └── AppContext.tsx          # AppProvider + useApp() — activeTool, userId, lists, wordsDue, hubAvailable
│   │
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts # Alt+number/letter navigation, ? for shortcuts modal
│   │   └── usePreferences.ts      # localStorage-backed user preferences with legacy migration
│   │
│   ├── lib/
│   │   └── csvParser.ts           # parseVocabText() — CSV, TSV, freeform, Arabic vocab parsing + isRTL()
│   │
│   ├── assets/                    # Images (hero.png, SVGs)
│   │
│   └── components/
│       ├── layout/
│       │   ├── AppShell.tsx        # Main layout — sidebar, mobile tabs, lazy ToolContent switch
│       │   ├── Sidebar.tsx         # Desktop/mobile collapsible navigation sidebar
│       │   └── ShortcutsModal.tsx  # Keyboard shortcuts reference overlay
│       │
│       ├── onboarding/
│       │   ├── Onboarding.tsx      # First-run onboarding flow (language selection, name)
│       │   └── Walkthrough.tsx     # Guided tour overlay (3 steps: Upload → Flashcards → Achievements)
│       │
│       ├── home/
│       │   └── DailyReview.tsx     # Daily review hub — due words, streak, quick actions
│       │
│       ├── wordbank/
│       │   ├── WordBank.tsx        # Browse, search, edit, delete vocabulary
│       │   └── VocabDashboard.tsx  # Progress dashboard — stats, charts, session history
│       │
│       ├── upload/
│       │   └── VocabUploader.tsx   # Import words via paste, file drop, or AI topic generation
│       │
│       ├── flashcards/
│       │   ├── FlashcardDeck.tsx   # Spaced repetition review session (FSRS-4.5)
│       │   └── FlashcardCard.tsx   # Individual flip card component
│       │
│       ├── games/
│       │   ├── MatchGame.tsx       # Drag-to-match word pairing game
│       │   ├── FillBlank.tsx       # Type the missing word in a sentence
│       │   ├── MultipleChoice.tsx  # Multiple choice quiz
│       │   └── ClozePractice.tsx   # AI-generated cloze sentences
│       │
│       ├── speaking/
│       │   └── SpeakingPractice.tsx # Pronunciation practice with TTS
│       │
│       ├── listening/
│       │   └── ListeningPractice.tsx # Hear a word/sentence, type what you hear
│       │
│       ├── reading/
│       │   └── ReadingAssist.tsx    # Interactive text reader with tap-to-translate
│       │
│       ├── writing/
│       │   └── WritingPractice.tsx  # Free writing with AI grammar correction
│       │
│       ├── prelearn/
│       │   └── PreLearnPipeline.tsx # Paste text → analyze unknown words → learn before reading
│       │
│       ├── stories/
│       │   └── StoryReader.tsx     # AI-generated graded reading stories with questions
│       │
│       ├── grammar/
│       │   └── GrammarLessons.tsx  # AI-generated grammar lessons with exercises
│       │
│       ├── universe/
│       │   └── VocabUniverse.tsx   # Visual vocabulary galaxy (3D/canvas visualization)
│       │
│       ├── teacher/
│       │   └── TeacherPortal.tsx   # Class management, assignments, student progress
│       │
│       ├── community/
│       │   └── Community.tsx       # Leaderboard, shared lists, friends
│       │
│       ├── achievements/
│       │   └── Achievements.tsx    # XP, badges, milestones, streaks
│       │
│       └── settings/
│           └── Settings.tsx        # User profile, preferences, TTS, language defaults
│
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript config (path alias: @/ → src/)
├── vite.config.ts                 # Vite + React plugin + Tailwind v4 plugin
└── index.html                     # HTML entry point
```

---

## Adding a New Tool

Follow these 5 steps to add a new learning tool:

### Step 1: Create the Component

Create your component in the appropriate `src/components/` subdirectory. Use named exports:

```tsx
// src/components/dictation/DictationPractice.tsx

export function DictationPractice() {
  // Your tool implementation
  return (
    <div>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Dictation Practice
      </h2>
      {/* ... */}
    </div>
  )
}
```

### Step 2: Add to `LinguaToolId` Union

In `src/types/tools.ts`, add your tool's ID to the union type:

```ts
export type LinguaToolId =
  | 'home'
  // ... existing tools ...
  | 'dictation'  // ← add here
```

### Step 3: Add to `TOOLS` Array

In the same file, add a `ToolDef` entry:

```ts
export const TOOLS: ToolDef[] = [
  // ... existing tools ...
  { id: 'dictation', label: 'Dictation', icon: '📝', description: 'Write what you hear', category: 'practice' },
]
```

Categories: `'main'` | `'vocab'` (word bank, upload, pre-learn) | `'practice'` | `'track'`

Client-side session state (not the HTTP API) lives in `src/services/clientStore.ts` and `src/services/dailySessionPlan.ts` — daily checklist, debrief prefs, and learning targets.

### Step 4: Add Lazy Import + Case in `AppShell.tsx`

In `src/components/layout/AppShell.tsx`:

```tsx
// Add lazy import at the top (named export pattern)
const DictationPractice = lazy(() =>
  import('@/components/dictation/DictationPractice').then(m => ({ default: m.DictationPractice }))
)

// Add case in the ToolContent switch
case 'dictation': return <DictationPractice />
```

### Step 5: Add Label in `Walkthrough.tsx`

In `src/components/onboarding/Walkthrough.tsx`, add the label mapping inside the `labels` record:

```ts
const labels: Record<LinguaToolId, string> = {
  // ... existing labels ...
  dictation: 'Dictation',
}
```

---

## Backend API Reference

All endpoints are served by Creative Hub at `http://localhost:8420`. The API client is in `src/services/vocabApi.ts`.

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (2s timeout) |

### Lists (`/vocab/lists`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/vocab/lists` | Create a new vocabulary list |
| `GET` | `/vocab/lists?user_id=` | Get all lists for a user |
| `PUT` | `/vocab/lists/:id` | Update list (e.g., deadline) |
| `DELETE` | `/vocab/lists/:id` | Delete a list |

**Create list body:**
```json
{ "user_id": "uuid", "name": "Chapter 1", "language_from": "en", "language_to": "de", "description": "..." }
```

### Words (`/vocab/words`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/vocab/upload` | Bulk upload words to a list |
| `GET` | `/vocab/words?user_id=&list_id=&search=&tag=&limit=&offset=` | Query words with filters |
| `GET` | `/vocab/words/:id` | Get a single word |
| `PUT` | `/vocab/words/:id` | Update word fields |
| `DELETE` | `/vocab/words/:id` | Delete a word |
| `POST` | `/vocab/reset-progress` | Reset all FSRS/SM-2 progress for a user |

**Upload body:**
```json
{
  "user_id": "uuid",
  "list_id": 1,
  "words": [
    { "lemma": "Haus", "translation": "house", "part_of_speech": "noun", "gender": "n" }
  ]
}
```

**Response:** `{ "added": 10, "skipped": 2 }`

### Review & Spaced Repetition

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/vocab/review` | Submit a review (triggers FSRS update) |
| `GET` | `/vocab/due?user_id=&limit=` | Get words due for review (sorted by retrievability) |
| `GET` | `/vocab/cram?user_id=&list_id=` | Get all words from a list for cramming |

**Review body:**
```json
{ "word_id": 42, "quality": 4, "user_id": "uuid" }
```

Quality scale: 0 = blackout, 1 = wrong, 2 = hard, 3 = correct-hard, 4 = correct-easy, 5 = perfect.

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/vocab/sessions` | Start a study session |
| `PUT` | `/vocab/sessions/:id` | End a session with results |

### Stats & Dashboard

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/vocab/stats?user_id=` | Aggregate statistics |
| `GET` | `/vocab/dashboard?user_id=` | Stats + lists + recent sessions |

### AI-Powered Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/vocab/generate-topic` | Generate vocabulary words for a topic via Ollama |
| `POST` | `/vocab/enrich` | AI-enrich words (add examples, pronunciation, POS) |
| `POST` | `/vocab/analyze` | Analyze text for known/unknown words (Pre-Learn) |
| `POST` | `/vocab/check-writing` | AI grammar/spelling correction |
| `POST` | `/vocab/sentences/generate` | Generate cloze sentences for words |
| `GET` | `/vocab/cloze-set?user_id=&count=` | Get a ready-made cloze practice set |
| `POST` | `/vocab/stories/generate` | Generate a graded reading story |
| `GET` | `/vocab/stories?user_id=&limit=` | List user's stories |
| `GET` | `/vocab/stories/:id` | Get a full story |
| `POST` | `/vocab/grammar/generate` | Generate a grammar lesson with exercises |

### TTS (Text-to-Speech)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/generate/speech` | Queue a TTS job (returns `{ job_id }`) |
| `GET` | `/jobs/:id` | Poll job status |
| `GET` | `/jobs/:id/output` | Stream the generated audio file |

**Async pattern:**
```ts
const { job_id } = await vocabApi.generateSpeech("Guten Morgen")
// Poll until completed
const job = await vocabApi.getJobStatus(job_id)
// Serve audio
const audioUrl = vocabApi.getJobOutputUrl(job_id)
```

### Teacher Portal (`/teacher/*`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/teacher/classes` | Create a class |
| `GET` | `/teacher/classes?teacher_id=` | List teacher's classes |
| `GET` | `/teacher/classes/:id` | Get class detail |
| `DELETE` | `/teacher/classes/:id` | Delete a class |
| `GET` | `/teacher/classes/:id/students` | List enrolled students |
| `POST` | `/teacher/join` | Student joins via join code |
| `POST` | `/teacher/assignments` | Create an assignment |
| `GET` | `/teacher/classes/:id/assignments` | List assignments for a class |
| `GET` | `/teacher/assignments/:id/progress` | Get per-student progress |
| `GET` | `/teacher/student-assignments?student_id=` | Get assignments for a student |
| `PUT` | `/teacher/assignment-progress` | Update student's assignment progress |

### Community (`/community/*`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/community/leaderboard?week=` | Get weekly leaderboard |
| `POST` | `/community/leaderboard` | Update leaderboard entry |
| `POST` | `/community/share` | Share a list publicly |
| `GET` | `/community/shared-lists?limit=&offset=` | Browse shared lists |
| `POST` | `/community/clone` | Clone a shared list by share code |
| `GET` | `/community/friends?user_id=` | Get friend list |

### Adding a New Backend Endpoint

1. Add the database function in `~/Projects/creative-hub/hub/database.py`
2. Add the FastAPI route in `~/Projects/creative-hub/hub/main.py`
3. Add the typed client function in `src/services/vocabApi.ts`
4. Add TypeScript interfaces for request/response types if needed

---

## Database Schema

All data is stored in SQLite at `~/Projects/creative-hub/hub/hub.db`. Key Lingua tables:

### `vocab_words`

The core vocabulary table with FSRS spaced-repetition fields.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `user_id` | TEXT | References `trainer_users(id)` |
| `list_id` | INTEGER | References `vocab_lists(id)`, nullable |
| `lemma` | TEXT | The word/phrase in the target language |
| `translation` | TEXT | Translation in the source language |
| `language_from` | TEXT | Source language code (e.g., `en`) |
| `language_to` | TEXT | Target language code (e.g., `de`) |
| `part_of_speech` | TEXT | noun, verb, adjective, etc. |
| `gender` | TEXT | Grammatical gender (m/f/n) |
| `pronunciation` | TEXT | IPA or phonetic representation |
| `example_sentence` | TEXT | Example usage in context |
| `example_translation` | TEXT | Translation of the example |
| `tags` | TEXT | JSON array of tags |
| `cefr_level` | TEXT | A1, A2, B1, B2, C1, C2 |
| `exposure_count` | INTEGER | Times the word has been seen |
| `last_seen` | TEXT | ISO timestamp of last review |
| `ease_factor` | REAL | Legacy SM-2 ease factor (default 2.5) |
| `interval_days` | REAL | Current review interval |
| `next_review` | TEXT | ISO timestamp of next scheduled review |
| `stability` | REAL | FSRS stability parameter |
| `difficulty` | REAL | FSRS difficulty parameter (1-10) |
| `reps` | INTEGER | Successful review count |
| `created_at` | TEXT | ISO timestamp |

**Unique constraint:** `(user_id, lemma, language_from, language_to)`

### `vocab_lists`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `user_id` | TEXT | Owner |
| `name` | TEXT | List name |
| `language_from` | TEXT | Source language |
| `language_to` | TEXT | Target language |
| `description` | TEXT | Optional description |
| `word_count` | INTEGER | Cached word count |
| `deadline` | TEXT | Optional study deadline |
| `created_at` | TEXT | ISO timestamp |

### `vocab_sessions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `user_id` | TEXT | Who studied |
| `tool_id` | TEXT | Which tool was used (e.g., `flashcards`) |
| `list_id` | INTEGER | Optional list being studied |
| `started_at` | TEXT | Session start |
| `ended_at` | TEXT | Session end |
| `duration_seconds` | REAL | Time spent |
| `words_reviewed` | INTEGER | Words seen |
| `correct` | INTEGER | Correct answers |
| `wrong` | INTEGER | Wrong answers |
| `score_data` | TEXT | JSON with tool-specific metrics |

### `vocab_sentences`

AI-generated cloze sentences linked to specific words.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `word_id` | INTEGER | References `vocab_words(id)` (CASCADE delete) |
| `user_id` | TEXT | Owner |
| `sentence` | TEXT | Full sentence |
| `translation` | TEXT | Sentence translation |
| `cloze_word` | TEXT | The word to blank out |
| `cefr_level` | TEXT | Difficulty level |
| `created_at` | TEXT | ISO timestamp |

### `vocab_stories`

AI-generated graded reading stories.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `user_id` | TEXT | Owner |
| `title` | TEXT | Story title |
| `content` | TEXT | Full story text |
| `topic` | TEXT | Story topic |
| `difficulty` | TEXT | easy, medium, hard |
| `language` | TEXT | Target language |
| `questions` | TEXT | JSON array of `{ question, answer }` |
| `target_word_ids` | TEXT | JSON array of word IDs used |
| `created_at` | TEXT | ISO timestamp |

### `teacher_classes`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `teacher_id` | TEXT | References `trainer_users(id)` |
| `name` | TEXT | Class name |
| `description` | TEXT | Optional |
| `join_code` | TEXT UNIQUE | Code students use to enroll |
| `language_from` | TEXT | Source language |
| `language_to` | TEXT | Target language |
| `created_at` | TEXT | ISO timestamp |

### `class_enrollments`

| Column | Type | Description |
|--------|------|-------------|
| `class_id` | INTEGER | References `teacher_classes(id)` (CASCADE) |
| `student_id` | TEXT | References `trainer_users(id)` |
| `enrolled_at` | TEXT | ISO timestamp |

### `assignments`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `class_id` | INTEGER | References `teacher_classes(id)` (CASCADE) |
| `teacher_id` | TEXT | Who created it |
| `title` | TEXT | Assignment title |
| `list_id` | INTEGER | Optional: entire list as assignment |
| `word_ids` | TEXT | JSON array of specific word IDs |
| `criteria` | TEXT | JSON: `{ min_accuracy, min_reviews }` |
| `deadline` | TEXT | Optional deadline |
| `status` | TEXT | `draft`, `active`, or `closed` |
| `assigned_at` | TEXT | ISO timestamp |

### `assignment_progress`

| Column | Type | Description |
|--------|------|-------------|
| `assignment_id` | INTEGER | References `assignments(id)` (CASCADE) |
| `student_id` | TEXT | References `trainer_users(id)` |
| `words_reviewed` | INTEGER | Words the student has reviewed |
| `words_mastered` | INTEGER | Words meeting criteria |
| `accuracy` | REAL | Percentage correct |
| `time_spent_seconds` | INTEGER | Total time studying |
| `completed` | INTEGER | 0 or 1 |
| `last_activity` | TEXT | ISO timestamp |

### `friendships`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Requester |
| `friend_id` | TEXT | Target |
| `status` | TEXT | `pending`, `accepted`, or `blocked` |

### `leaderboard_entries`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Player |
| `week` | TEXT | ISO week string (e.g., `2026-W12`) |
| `xp_earned` | INTEGER | XP for this week |
| `words_learned` | INTEGER | New words mastered |
| `streak_days` | INTEGER | Current streak |
| `accuracy` | REAL | Average accuracy |

### `shared_lists`

| Column | Type | Description |
|--------|------|-------------|
| `list_id` | INTEGER | References `vocab_lists(id)` |
| `shared_by` | TEXT | Who shared it |
| `share_code` | TEXT UNIQUE | Short code for cloning |
| `title` | TEXT | Display title |
| `likes` | INTEGER | Like count |
| `downloads` | INTEGER | Clone count |

---

## Design System

### CSS Custom Properties

All colors are defined as CSS custom properties in `src/index.css` and referenced throughout the app via `var(--color-*)`. Never use hardcoded hex colors in components.

**Light mode (`:root`):**

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#FAFBFC` | Page background |
| `--color-surface` | `#FFFFFF` | Card/panel background |
| `--color-surface-alt` | `#F8FAFC` | Alternate surface |
| `--color-border` | `#E5E7EB` | Borders and dividers |
| `--color-primary-dark` | `#1E3A5F` | Dark brand accent |
| `--color-primary-main` | `#2563EB` | Primary buttons, links |
| `--color-primary-mid` | `#3B82F6` | Hover states |
| `--color-primary-light` | `#60A5FA` | Lighter accents |
| `--color-primary-bright` | `#93C5FD` | Tags, badges |
| `--color-primary-faded` | `#DBEAFE` | Light backgrounds |
| `--color-primary-pale` | `#EFF6FF` | Subtle highlights |
| `--color-accent` | `#F59E0B` | Warm orange accent (XP, streaks) |
| `--color-accent-light` | `#FEF3C7` | Light accent bg |
| `--color-accent-mid` | `#FBBF24` | Medium accent |
| `--color-accent-dark` | `#B45309` | Dark accent |
| `--color-accent-faded` | `#FFFBEB` | Very light accent bg |
| `--color-correct` | `#059669` | Correct answers (green) |
| `--color-incorrect` | `#EF4444` | Wrong answers (red) |
| `--color-text-primary` | `#111827` | Main text |
| `--color-text-secondary` | `#4B5563` | Secondary text |
| `--color-text-muted` | `#9CA3AF` | Muted/placeholder text |
| `--color-gray-*` | Various | Gray scale (100-900) |

### Dark Mode

Dark mode is implemented by toggling the `.dark` class on `<html>`. The `.dark` selector in `index.css` overrides the CSS custom properties with dark values.

- Managed by `ThemeProvider` in `src/design/theme.tsx`
- Persisted in `localStorage` key `lingua-theme`
- Respects `prefers-color-scheme` on first visit
- Toggle via `useTheme().toggle()`

### Component Patterns

Components are organized loosely by complexity but do not follow a strict atoms/molecules/organisms hierarchy. Common patterns:

- Styled with Tailwind utility classes + CSS custom properties for colors
- `framer-motion` for animations (page transitions, card flips, progress bars)
- `react-hot-toast` for notifications (`toast.success()`, `toast.error()`)
- `clsx` for conditional class composition

### RTL Support

Right-to-left language support is provided via the `isRTL()` function in `src/lib/csvParser.ts`:

```ts
import { isRTL } from '@/lib/csvParser'

// Supported RTL languages: ar (Arabic), he (Hebrew), fa (Persian), ur (Urdu)
if (isRTL(word.language_to)) {
  // Apply dir="rtl" or RTL-specific styling
}
```

---

## State Management

### AppContext

The central state container (`src/context/AppContext.tsx`) provides:

| Value | Type | Description |
|-------|------|-------------|
| `activeTool` | `LinguaToolId` | Currently displayed tool |
| `setActiveTool` | Function | Navigate to a tool |
| `lists` | `VocabList[]` | User's vocabulary lists (fetched on mount) |
| `currentListId` | `number \| null` | Currently selected list |
| `setCurrentListId` | Function | Select a list |
| `refreshLists` | Function | Re-fetch lists from backend |
| `userId` | `string` | UUID, auto-generated and persisted in localStorage |
| `hubAvailable` | `boolean` | Whether the backend is reachable |
| `wordsDue` | `number` | Count of words due for review |
| `setWordsDue` | Function | Update due count |

Access via `useApp()`:

```tsx
const { activeTool, setActiveTool, lists, userId, hubAvailable } = useApp()
```

### Preferences

User preferences are managed by `usePreferences()` in `src/hooks/usePreferences.ts`:

| Preference | Type | Default | Description |
|------------|------|---------|-------------|
| `userName` | `string` | `''` | Display name |
| `dailyGoal` | `number` | `10` | Daily review target |
| `defaultLangFrom` | `string` | `''` | Default source language |
| `defaultLangTo` | `string` | `''` | Default target language |
| `autoPlayTts` | `boolean` | `false` | Auto-play pronunciation |
| `sidebarCollapsed` | `Record<string, boolean>` | `{}` | Sidebar category collapse state |
| `walkthroughDone` | `boolean` | `false` | Whether onboarding walkthrough completed |

Stored in `localStorage` under key `lingua-preferences`. The hook includes automatic migration from legacy per-key storage.

### Provider Stack

The provider hierarchy in `App.tsx`:

```
ThemeProvider         (dark mode state)
  └── AppProvider     (activeTool, userId, lists, hubAvailable)
        └── AppContent
              ├── Onboarding    (if first run)
              └── AppShell      (main app)
        └── Toaster           (react-hot-toast)
```

---

## FSRS Algorithm

Lingua uses **FSRS-4.5** (Free Spaced Repetition Scheduler) for spaced repetition, replacing the simpler SM-2 algorithm. The implementation lives in `~/Projects/creative-hub/hub/database.py`.

### How It Works

FSRS models memory with two core parameters per word:

- **Stability (S)**: How many days until the probability of recall drops to the desired retention rate (default 90%). Higher stability = longer intervals.
- **Difficulty (D)**: How hard the word is to learn (range 1-10). Affects how quickly stability grows.

### Review Flow

1. User reviews a word and rates quality 0-5
2. Quality is mapped to FSRS rating 1-4:
   - 0-1 → **Again** (1) — forgotten
   - 2 → **Hard** (2)
   - 3 → **Good** (3)
   - 4-5 → **Easy** (4)
3. FSRS computes:
   - **Retrievability** — current probability of recall based on elapsed time
   - **New stability** — updated based on success/failure and current difficulty
   - **New difficulty** — adjusted toward the word's true difficulty
   - **Next interval** — `I = 9 * S * (1/R_desired - 1)` where `R_desired = 0.9`
4. The word's `next_review` timestamp is set to `now + interval`

### Due Words Ordering

Words due for review are sorted by **retrievability ascending** — the word you're most likely to have forgotten comes first. New (never-reviewed) words get retrievability 0, making them highest priority.

### Key Parameters

```python
FSRS_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
FSRS_DESIRED_RETENTION = 0.9  # 90% target recall
```

These are the empirically validated FSRS-4.5 default weights. They can be personalized per-user in the future by fitting to individual review history.

---

## Testing & Build

### Development Server

```bash
cd ~/D2D/lingua
npm run dev    # Starts Vite dev server on port 5174
```

The dev server provides HMR (Hot Module Replacement) — changes appear instantly without full page reload.

### Production Build

```bash
npm run build  # Runs tsc type-check + Vite production build
```

Output goes to `dist/`. Preview the production build:

```bash
npm run preview
```

### Linting

```bash
npm run lint   # ESLint with React Hooks + React Refresh plugins
```

### Backend

The Creative Hub backend must be running for full functionality:

```bash
~/Projects/creative-hub/scripts/start_services.sh all
```

This starts the FastAPI server on port 8420 and all AI services.

### Testing (Future)

No test framework is currently configured. The recommended setup:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `vite.config.ts`:

```ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```

---

## Deployment

### Current Setup

Lingua runs entirely on localhost:
- Frontend: `localhost:5174` (Vite dev server)
- Backend: `localhost:8420` (Creative Hub FastAPI)
- Ollama: `localhost:11434` (local LLM inference)

### Production Considerations

**Environment Variables:**

The backend URL is currently hardcoded in `vocabApi.ts`:

```ts
const BASE_URL = 'http://localhost:8420'
```

For production, extract to an environment variable:

```ts
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8420'
```

**Database Migration (SQLite to PostgreSQL):**

The SQLite schema uses standard SQL. Key changes needed for PostgreSQL:
- Replace `AUTOINCREMENT` with `SERIAL` or `GENERATED ALWAYS AS IDENTITY`
- Replace `datetime('now')` with `NOW()`
- Replace `TEXT` for JSON columns with `JSONB`
- Add a connection pool (e.g., asyncpg with SQLAlchemy)

**Ollama Hosting:**

For production, Ollama can be deployed on a GPU server. Set the `OLLAMA_HOST` environment variable in the Creative Hub config.

**Docker Strategy:**

```dockerfile
# Frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

The backend (Creative Hub) would need its own container with Python 3.10+, SQLite (or PostgreSQL driver), and Ollama access.

---

## Code Conventions

### Exports

- **Named exports** for all components: `export function WordBank() {}`
- Lazy imports use the `.then(m => ({ default: m.ComponentName }))` pattern to bridge named exports with `React.lazy()`

### Styling

- All colors via CSS custom properties: `var(--color-*)` — never hardcode hex values
- Tailwind v4 utility classes for layout, spacing, typography
- Inline `style={}` for dynamic CSS variable references (Tailwind v4 does not support arbitrary `var()` in class names in all cases)
- `framer-motion` for animations (transitions, flip cards, progress bars)

### Notifications

```tsx
import toast from 'react-hot-toast'

toast.success('Words uploaded!')
toast.error('Backend is offline')
toast('Processing...', { icon: '...' })
```

### API Calls

Always go through `vocabApi.ts`. Never use `fetch()` directly in components:

```tsx
import * as api from '@/services/vocabApi'

// In a component or hook:
const words = await api.getWords(userId, { list_id: 1, limit: 50 })
const result = await api.submitReview({ word_id: 42, quality: 4, user_id: userId })
```

### Content Parsing

Use `parseVocabText()` from `src/lib/csvParser.ts` for all vocabulary import. It handles:
- CSV with headers (lemma/word/term, translation/meaning/definition, pos, gender, tags, example, pronunciation)
- TSV (tab-separated)
- Freeform text (word - translation, word = translation, word : translation)
- Arabic vocabulary with POS markers

### Keyboard Shortcuts

- `?` — Toggle shortcuts modal
- `Alt+1` through `Alt+9` — Navigate to tool by position
- `Alt+H` — Home
- `Alt+F` — Flashcards
- `Alt+U` — Upload

Shortcuts are disabled when focus is on `INPUT`, `TEXTAREA`, or `SELECT` elements.

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.x | UI framework |
| `react-dom` | 19.x | DOM rendering |
| `tailwindcss` | 4.x | Utility-first CSS |
| `@tailwindcss/vite` | 4.x | Tailwind Vite plugin |
| `framer-motion` | 12.x | Animations |
| `react-hot-toast` | 2.x | Toast notifications |
| `clsx` | 2.x | Conditional class names |
| `uuid` | 13.x | UUID generation |
| `vite` | 8.x | Build tool + dev server |
| `typescript` | 5.9.x | Type checking |

---

## Useful File Paths

| File | Purpose |
|------|---------|
| `src/services/vocabApi.ts` | All backend API calls — start here to understand data flow |
| `src/types/tools.ts` | Tool registry — add new tools here |
| `src/types/word.ts` | Core data types (Word, VocabList, VocabSession, VocabStats) |
| `src/context/AppContext.tsx` | Global state — activeTool, userId, lists |
| `src/components/layout/AppShell.tsx` | Routing/layout — lazy imports and tool switch |
| `src/index.css` | Design tokens (CSS custom properties, dark mode) |
| `src/lib/csvParser.ts` | Vocabulary text parsing + RTL detection |
| `src/hooks/usePreferences.ts` | User preferences with localStorage persistence |
| `~/Projects/creative-hub/hub/database.py` | Backend database schema + FSRS algorithm |
| `~/Projects/creative-hub/hub/main.py` | Backend API routes (FastAPI) |
