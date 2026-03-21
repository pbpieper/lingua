# Lingua User Guide

Lingua is a personal language learning platform that combines smart vocabulary management with AI-powered practice tools. Whether you are preparing for an exam, brushing up for travel, or diving deep into a new language, Lingua adapts to your goals and tracks your progress every step of the way.

This guide covers everything you need to know -- from first-time setup to advanced features like the Teacher Portal and Chrome Extension.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [Learning Tools](#learning-tools)
   - [Home](#1-home)
   - [Word Bank](#2-word-bank)
   - [Upload](#3-upload)
   - [Flashcards](#4-flashcards)
   - [Pre-Learn Pipeline](#5-pre-learn-pipeline)
   - [Match Game](#6-match-game)
   - [Fill in the Blank](#7-fill-in-the-blank)
   - [Quiz (Multiple Choice)](#8-quiz-multiple-choice)
   - [Speaking](#9-speaking)
   - [Reading Assist](#10-reading-assist)
   - [Listening](#11-listening)
   - [Writing](#12-writing)
   - [Sentence Cloze](#13-sentence-cloze)
   - [Stories](#14-stories)
   - [Grammar](#15-grammar)
   - [Universe](#16-universe)
   - [Teacher Portal](#17-teacher-portal)
   - [Community](#18-community)
   - [Achievements](#19-achievements)
   - [Progress Dashboard](#20-progress-dashboard)
   - [Settings](#21-settings)
4. [Chrome Extension (Copilot)](#chrome-extension-copilot)
5. [For Teachers](#for-teachers)
6. [Tips and Shortcuts](#tips-and-shortcuts)

---

## Getting Started

### What You Need

- **Node.js** (version 18 or later). Download it from [nodejs.org](https://nodejs.org/) if you do not have it already.
- **A terminal** -- Terminal on macOS, Command Prompt or PowerShell on Windows, or any terminal emulator on Linux.
- **The Creative Hub backend** (optional but recommended). This powers AI features like text-to-speech, AI-generated vocabulary, grammar lessons, stories, and writing corrections.

### Installation

1. Open your terminal and navigate to the Lingua directory:

   ```
   cd ~/D2D/lingua
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Start the development server:

   ```
   npm run dev
   ```

4. Open your browser to **http://localhost:5174**. That is it -- Lingua is running.

### Starting the AI Backend (Optional)

Many of Lingua's tools are enhanced by the Creative Hub, a local AI backend. To enable AI-powered features (vocabulary generation, grammar lessons, stories, speaking practice, writing correction, and more):

```
~/Projects/creative-hub/scripts/start_services.sh all
```

The backend runs on **http://localhost:8420**. When it is available, Lingua detects it automatically. If the backend is offline, you will see a small "Backend offline" badge in the app. All core features (flashcards, word bank, games) work perfectly without it -- the AI features simply become unavailable.

### First-Time Onboarding

When you open Lingua for the first time, a five-step onboarding wizard walks you through setup:

1. **Welcome** -- A brief introduction. Click "Get Started" to begin.
2. **Languages** -- Choose the language you are learning (Arabic, German, Spanish, French, Italian, Japanese, Korean, Dutch, Portuguese, Russian, Turkish, or Chinese) and your native language. English is the default native language, but you can pick any of the supported languages.
3. **Proficiency Level** -- Select your current level:
   - **Beginner** (A1-A2): You know a few words and simple phrases.
   - **Intermediate** (B1-B2): You can hold a conversation on familiar topics.
   - **Advanced** (C1-C2): You can read news and discuss complex topics.
4. **Goals and Daily Time** -- Tell Lingua why you are learning (pass an exam, travel, connect with family, career, personal enrichment, or consume media). Then pick your daily study goal: 5, 15, 30, or 60 minutes.
5. **Summary** -- Review your choices and click "Let's go!" to enter the app.

You can change any of these settings later from the Settings page.

### Understanding the Interface

**On desktop**, the left sidebar organizes all 21 tools into collapsible groups:

- **Home** is always visible at the top.
- **Learn** -- Word Bank, Upload, Flashcards, Pre-Learn.
- **Practice** -- Match, Fill Blank, Quiz, Speaking, Reading, Listening, Writing, Sentence Cloze, Stories, Grammar.
- **Track** -- Universe, Teacher, Community, Achievements, Progress, Settings.

Click any group header to expand or collapse it. A badge on the Learn group shows how many flashcards are due for review.

**On mobile**, a bottom tab bar gives quick access to Home, Flashcards, Games, Progress, and Words. Tap the hamburger menu (top-left) to open the full sidebar.

**Dark mode**: Toggle between light and dark themes using the sun/moon button in the top-right corner.

---

## Core Concepts

### Word Bank

Your Word Bank is your personal vocabulary library -- every word you import, generate, or encounter flows into it. Each word entry stores:

- The word itself (lemma) and its translation
- Part of speech, gender, and pronunciation
- An example sentence with translation
- Tags for organization (e.g., "food", "travel", "chapter-3")
- CEFR level (A1 through C2)
- Spaced repetition data (when it is next due for review, how well you know it)

### Lists

Lists let you organize words by topic, source, or purpose. For example, you might have lists like "German A2 Verbs", "Restaurant Vocabulary", or "Chapter 5 Textbook Words". You can filter flashcards and games by list, and assign lists to students if you are a teacher.

### Spaced Repetition (FSRS)

Lingua uses a spaced repetition algorithm to schedule your reviews. Here is the idea in plain English:

- When you first learn a word, you will see it again soon.
- Each time you recall it successfully, the gap before the next review gets longer.
- If you forget a word, the gap shrinks back down.
- Over time, well-known words appear less often, while tricky words get extra attention.

The result: you spend your study time on the words that need it most, and you review each word right before you would forget it. This is one of the most effective techniques in memory science.

When reviewing flashcards, you rate yourself on a four-point scale:

| Rating | What it means | Effect |
|--------|---------------|--------|
| **Again** | I did not know this | Resets the interval -- you will see it again soon |
| **Hard** | I got it, but it was tough | Short interval increase |
| **Good** | I remembered it | Normal interval increase |
| **Easy** | I knew it instantly | Large interval increase |

### Known Words Counter

Your "Known Words" count tracks how many unique words you have reviewed at least once with the spaced repetition system. Watching this number grow is one of the most motivating parts of the app.

### CEFR Levels (A1-C2)

The Common European Framework of Reference for Languages defines six levels:

| Level | Description |
|-------|-------------|
| **A1** | Beginner -- basic phrases, simple interactions |
| **A2** | Elementary -- routine tasks, simple descriptions |
| **B1** | Intermediate -- travel, opinions, familiar topics |
| **B2** | Upper Intermediate -- complex texts, fluent interaction |
| **C1** | Advanced -- implicit meaning, flexible language use |
| **C2** | Mastery -- near-native comprehension and expression |

Lingua uses CEFR levels to tag vocabulary, calibrate AI-generated content (grammar lessons, stories), and track your overall progress.

---

## Learning Tools

### 1. Home

**What it does:** Your daily command center. Home shows you a personalized greeting in your target language, your current streak, a summary of words due for review, and smart suggestions based on your learning goals.

**How to use it:**
- Check your streak and daily study time at the top.
- See how many flashcards are due and jump straight into a review session.
- Follow goal-based suggestions -- for example, if you said you are learning for travel, Home might suggest generating "At the Hotel" vocabulary.
- View your recent session history to see what you have been working on.

**Tips:**
- Make Home your daily starting point. The suggestions adapt to your goals (career, travel, academic, etc.) and nudge you toward the right tools.
- The greeting changes by time of day and appears in your target language -- a small daily immersion moment.

---

### 2. Word Bank

**What it does:** Browse, search, edit, and manage your entire vocabulary library. Think of it as a smart dictionary that tracks everything you are learning.

**How to use it:**
- **Browse** your words in a sortable table. Sort by word, date added, next review date, or exposure count.
- **Search** to filter words by name.
- **Filter by list** using the list selector to view words from a specific topic.
- **Inline editing** -- click on any word to edit its translation, tags, part of speech, gender, example sentence, and more.
- **Tag management** -- add or remove tags to organize words however makes sense to you.
- **Export** your vocabulary as CSV (for spreadsheets) or in Anki format (tab-separated text ready to import into Anki).
- **Generate a printable quiz** -- the Word Bank can create a formatted HTML quiz with matching, fill-in-the-blank, and translation exercises for any list.

**Tips:**
- Use tags to create cross-cutting categories that span multiple lists. For example, tag all food words across all your lists with "food" so you can filter flashcard sessions by that tag.
- Export to Anki if you want to study on a different platform or on a device where Lingua is not available.
- The printable quiz feature is great for teachers who want to create paper-based tests.

---

### 3. Upload

**What it does:** Import vocabulary into Lingua from files, text, or AI generation.

**How to use it:**

There are three ways to get words in:

1. **File upload** -- Drag and drop a CSV, TSV, or TXT file onto the drop zone (or click to browse). Lingua auto-detects the format.

2. **Paste text** -- Paste word lists directly into the text area. Lingua understands multiple formats:
   ```
   word, translation
   Haus, house
   Katze, cat
   ```
   or:
   ```
   Hund - dog
   Baum - tree
   ```

3. **AI topic generation** -- Type a topic (like "At the restaurant" or "Computer science") and pick a CEFR level (A1 through B2). Lingua uses AI to generate a relevant vocabulary list for that topic. This requires the Creative Hub backend.

After parsing or generating, you see a **preview table** where you can review and remove individual words before importing. Give your list a name (e.g., "German A2 Verbs") and click Import.

After import, you can optionally click **AI Enrich** to have the AI fill in missing example sentences, pronunciation guides, and part-of-speech information.

**Tips:**
- AI topic generation is fantastic for exploring new vocabulary areas. Try topics like "Emotions", "Office supplies", or "Cooking verbs".
- Always review the preview table before importing -- AI-generated lists occasionally include duplicates or oddities that are easy to spot and remove.
- The enrichment step is worth doing. Example sentences make flashcards much more effective because they provide context.

---

### 4. Flashcards

**What it does:** The core study tool. FSRS-powered spaced repetition flashcards that adapt to your memory.

**How to use it:**
- Open Flashcards and the app loads words that are due for review.
- A card appears showing the word (or translation, depending on mode). Press **Space** or click the card to flip it.
- After flipping, rate yourself: **Again** (1), **Hard** (2), **Good** (3), or **Easy** (4). Use the keyboard number keys for speed.
- The app tracks your score and time. At the end of the session, you see a summary with cards reviewed, accuracy, and elapsed time.

**Modes:**
- **Recognition mode** (default): You see the word in the target language and try to recall the translation.
- **Production mode**: You see the translation and try to recall the word in the target language. This is harder but builds active recall.

**Cram mode:** If a list has a deadline (e.g., an exam date), a banner appears showing how many days remain. Enable Cram mode to review all words in that list, not just the ones that are due -- perfect for last-minute exam prep.

**Tag filtering:** If your words have tags, filter chips appear above the cards. Click a tag to review only words with that tag.

**Tips:**
- Do your flashcard reviews daily. Consistency beats marathon sessions -- 15 minutes a day is more effective than two hours once a week.
- Use Production mode once you are comfortable with Recognition mode. Being able to produce the word (not just recognize it) is what you need for speaking and writing.
- The "AI Enrich" button on individual cards fills in missing example sentences and pronunciation -- tap it for cards that feel too bare.

---

### 5. Pre-Learn Pipeline

**What it does:** Paste a text you are about to read (an article, textbook chapter, email, or anything else) and Lingua identifies the words you do not know yet. You can then create a study set from those unknown words and learn them before reading.

**How to use it:**
1. Select the text's language and your native language.
2. Paste the text into the text area or drop a .txt file.
3. Click **Analyze Text**.
4. Lingua shows a **comprehension estimate** -- a percentage indicating how much of the text you are likely to understand based on your current Word Bank.
5. Below that, you see a list of all unknown words with their translations, parts of speech, and genders. Each word has a checkbox.
6. Select the words you want to study (all are selected by default), give the study set a name, and click **Create Study Set**.
7. You can then jump directly into Flashcards with that study set, or save it for later.

**Tips:**
- Use Pre-Learn before reading news articles, textbook chapters, or emails. Learning the key vocabulary first dramatically improves comprehension.
- The comprehension estimate is a helpful reality check. Below 50% means you will struggle significantly; above 90% means you are ready to read comfortably.
- This is one of the most powerful tools in Lingua -- it bridges the gap between "I have vocabulary" and "I can read real texts."

---

### 6. Match Game

**What it does:** A timed memory-matching game. Pair words with their translations by clicking cards on a grid.

**How to use it:**
- The game loads 6 words from your current list and creates 12 cards (6 words + 6 translations), shuffled randomly.
- Click a card to reveal it, then click a second card. If they match (word + its translation), both cards stay face-up and turn green.
- If they do not match, both cards flash red briefly and flip back face-down.
- A timer runs throughout the game. Try to match all pairs as quickly as possible with as few attempts as you can.
- When you finish, you see your time, accuracy percentage, and a score (based on speed and accuracy).

**Tips:**
- Match Game is great for a quick, fun warm-up before a more intensive study session.
- Play it when you want something lighter than flashcards. The game mechanics reinforce word-translation associations through active recall.
- You need at least 4 words in your current list to play.

---

### 7. Fill in the Blank

**What it does:** Complete sentences with missing words. Lingua takes your vocabulary words and either blanks them out of their example sentences or presents a "blank = translation" prompt.

**How to use it:**
- A sentence appears with a blank where the target word belongs. The translation or context around the blank helps you figure out the answer.
- Type your answer and press Enter (or click Check).
- If correct, the answer highlights in green and you move to the next question.
- If incorrect, the correct answer is shown. You can see your running score throughout the session.

**Tips:**
- This exercise is excellent for practicing spelling and learning words in context.
- The AI enrichment step (from Upload) fills in example sentences, which makes Fill in the Blank much more effective. Words without example sentences fall back to a simpler "blank = translation" format.
- Try this tool after a flashcard session to reinforce the same words in a different way.

---

### 8. Quiz (Multiple Choice)

**What it does:** Test yourself with four-option multiple choice questions. Each round has up to 10 questions.

**How to use it:**
- A word appears in the target language with four translation options below it.
- Click the answer you think is correct.
- Correct answers highlight in green; wrong answers highlight in red with the correct one also shown.
- The quiz auto-advances after a brief pause so you can see the correct answer.
- At the end, you see your score and accuracy.

**Tips:**
- Multiple Choice is a low-pressure way to review vocabulary. It is easier than flashcards because you have options to choose from, making it a good warm-up.
- You need at least 4 words in your vocabulary for the quiz to generate meaningful distractors.
- Each correct answer also feeds into the spaced repetition system, so quiz reviews count toward your schedule.

---

### 9. Speaking

**What it does:** Practice pronunciation with text-to-speech playback and have AI-powered conversations in your target language.

**How to use it:**

The Speaking tool has two modes:

1. **Pronunciation mode**: Select words from your vocabulary. Lingua reads them aloud using text-to-speech (via the Creative Hub backend or your browser's built-in speech synthesis). Listen, repeat, and compare.

2. **Conversation mode**: Have a back-and-forth conversation with an AI tutor in your target language. The AI adapts to your level and keeps the conversation natural. Great for practicing real-world dialogue.

**Tips:**
- Pronunciation mode works best with the Creative Hub backend running (higher quality TTS via Coqui). If the backend is offline, Lingua falls back to your browser's built-in speech synthesis.
- Conversation mode requires the Creative Hub backend (it uses the Ollama LLM).
- Even if you cannot speak back to the AI, typing your responses in the target language is valuable writing practice.

---

### 10. Reading Assist

**What it does:** Paste any text and see it color-coded by your knowledge level. Known words appear in one color, unknown words in another. Click any word for details.

**How to use it:**
1. Paste a text in your target language into the input area.
2. Click **Analyze**.
3. The text appears with words highlighted:
   - **Known words** (in your Word Bank) are displayed normally.
   - **Unknown words** are highlighted so they stand out.
4. Click any word to see its details -- translation, part of speech, example sentence, and more (if it is in your Word Bank).
5. A stats bar shows total words, unique words, how many you know, and your overall coverage percentage.

**Tips:**
- Use Reading Assist alongside Pre-Learn. First analyze the text with Pre-Learn to create a study set, study those words, then come back to Reading Assist to read the text with confidence.
- The coverage percentage gives you a quick sense of whether a text is at the right level for you. Aim for 90%+ coverage for comfortable reading.
- This tool loads your entire Word Bank (up to 5,000 words) to check against, so it works offline without the backend.

---

### 11. Listening

**What it does:** Dictation exercises -- hear a word or phrase spoken aloud and type what you hear.

**How to use it:**
1. Choose a list and configure settings (word mode or translation mode).
2. A word is spoken aloud using text-to-speech.
3. Type what you heard into the input field.
4. Check your answer. The tool shows whether you were correct and lets you replay the audio.
5. At the end of the exercise, you see a results summary with your accuracy.

**TTS engines:** Lingua tries three approaches in order:
- **Creative Hub TTS** (Coqui) -- highest quality, requires the backend.
- **Browser speech synthesis** -- built into most modern browsers, no setup required.
- **None** -- if neither is available, the tool cannot function.

**Tips:**
- Listening exercises train your ear for the sounds of the language. This is especially valuable for languages with unfamiliar phonetics (Arabic, Japanese, Korean, Chinese).
- Start with Word mode (hearing individual words) before trying full phrases.
- Use headphones for better audio clarity.

---

### 12. Writing

**What it does:** Write freely in your target language and get AI-powered corrections and feedback.

**How to use it:**
1. Choose the language you want to write in.
2. You can write about anything, or click the **prompt button** to get a random writing prompt in your target language. Prompts include everyday topics like "Describe your daily routine", "Write about your favorite food", or "Describe the weather today". Prompts are available in German, Spanish, French, Italian, Portuguese, and more.
3. Write your text in the text area.
4. Submit for AI correction. The AI reviews your text and returns corrections covering grammar, vocabulary, and style.

**Tips:**
- Writing is one of the best ways to move from passive knowledge (recognition) to active knowledge (production).
- Do not worry about making mistakes -- that is the whole point. The AI corrections teach you the right forms.
- Try to use vocabulary from your recent flashcard sessions. This reinforces the words through a different skill.
- This tool requires the Creative Hub backend for AI corrections.

---

### 13. Sentence Cloze

**What it does:** AI-generated context sentences with fill-in-the-blank exercises, integrated with the spaced repetition system.

**How to use it:**
1. Click **Generate** to have AI create context sentences for your vocabulary words, or use existing sentences from previous sessions.
2. A sentence appears with one word replaced by a blank.
3. Type the missing word. The tool uses fuzzy matching (Levenshtein distance) so minor typos do not count as wrong.
4. You can click **Hint** to reveal the first letter of the answer.
5. Each answer feeds into the spaced repetition system -- correct answers extend the review interval, wrong answers shorten it.
6. A streak counter tracks consecutive correct answers. Try to beat your best streak.

**Tips:**
- Sentence Cloze is one of the most effective exercises because it forces you to recall words in realistic context, not in isolation.
- The hint feature is useful when you are stuck -- seeing the first letter is often enough to trigger recall.
- Use this tool after flashcards for the same word list. Seeing the words in different sentence contexts deepens your understanding.

---

### 14. Stories

**What it does:** AI-generated graded reading passages personalized to your vocabulary, with difficulty levels and comprehension questions.

**How to use it:**
1. Select a difficulty level (easy, medium, or hard).
2. Lingua generates a short story tailored to your vocabulary level, using words from your Word Bank when possible.
3. Read the story. Words are highlighted based on whether they are in your Word Bank (known vs. unknown), just like in Reading Assist.
4. After reading, answer comprehension questions. For each question, click "Show Answer" to see the correct response, then self-assess whether you knew it.

**Tips:**
- Stories provide immersive reading practice without the pressure of finding your own texts.
- Start with "easy" stories and work your way up. The AI adjusts vocabulary complexity based on difficulty level.
- Use the unknown-word highlights as a signal -- if too many words are highlighted, drop down a difficulty level.
- This tool requires the Creative Hub backend for story generation.

---

### 15. Grammar

**What it does:** AI-generated grammar lessons with interactive exercises, organized by CEFR level.

**How to use it:**
1. Choose a language (German, Spanish, French, Italian, Portuguese, Japanese, Mandarin, Arabic, Korean, or Russian).
2. Select a CEFR level (A1 through C2). A list of relevant grammar topics appears (e.g., A1: Present tense, Articles, Plurals; B1: Subjunctive, Passive voice, Relative clauses).
3. Click a suggested topic or type your own custom topic.
4. Click **Generate Lesson**. The AI creates a lesson with explanations, examples, and interactive exercises.
5. Work through the exercises -- fill in blanks, answer questions, and check your answers.
6. Your score is tracked at the bottom of the lesson.

**Tips:**
- Grammar lessons are great for structured learning alongside the vocabulary-focused tools.
- Use the custom topic field to ask about specific grammar points you are struggling with. For example, type "when to use dative vs. accusative" for a German lesson.
- The exercises are interactive -- you type answers and get immediate feedback, which is more effective than just reading explanations.
- This tool requires the Creative Hub backend.

---

### 16. Universe

**What it does:** A galaxy visualization of your entire vocabulary. Each word is a star, and its brightness reflects how well you know it.

**How to use it:**
- Open Universe to see your vocabulary galaxy. Stars are arranged in spiral patterns, grouped by list (each list forms a "constellation").
- Star colors indicate mastery level:
  - **Gray** (Undiscovered) -- new, unreviewed words
  - **Amber** (Emerging) -- words you have started learning
  - **Blue** (Orbiting) -- words you are getting familiar with
  - **Green** (Radiant) -- fully mastered words
- Click on any star to see the word details.
- Switch between Galaxy view, Constellation view (one list at a time), and Stats view.

**Tips:**
- Universe is more than eye candy -- it gives you an intuitive sense of your vocabulary landscape. A galaxy full of green stars means you are doing well.
- Zoom in on clusters of gray stars to identify lists or topics that need more attention.
- Check back periodically to see your galaxy brighten as you study.

---

### 17. Teacher Portal

**What it does:** Create and manage classes, assign vocabulary lists to students, and track their progress.

**How to use it:**
1. Click **+ New Class** to create a class. Give it a name, description, and set the language pair.
2. A unique **join code** is generated automatically. Share this code with students so they can join your class.
3. Once students join, you can:
   - View the class roster with student counts.
   - Create **assignments** by linking vocabulary lists with deadlines and completion criteria.
   - Track student progress on each assignment.
4. Click on any class to see its details, assignments, and student progress.

**Tips:**
- See the dedicated [For Teachers](#for-teachers) section below for a detailed walkthrough.

---

### 18. Community

**What it does:** A social hub with a leaderboard, shared vocabulary lists, and friend connections.

**How to use it:**

The Community page has three tabs:

1. **Leaderboard** -- See how you rank against other learners this week. Rankings are based on XP earned from reviews, with metrics for words learned, streak days, and accuracy. Top 3 positions show gold, silver, and bronze medals.

2. **Shared Lists** -- Browse vocabulary lists that other users have shared publicly. Click to import a shared list into your own Word Bank. You can also share your own lists with the community.

3. **Friends** -- Connect with other learners. See their activity and cheer each other on.

**Tips:**
- The leaderboard resets weekly, so everyone gets a fresh start. Complete reviews consistently to climb the rankings.
- Shared Lists are a goldmine -- look for lists that match topics or courses you are studying.
- Compete with friends for extra motivation. Even a friendly rivalry can double your daily study time.

---

### 19. Achievements

**What it does:** An XP and badge system that rewards consistent study habits.

**How to use it:**
- View your total XP, current level, and progress toward the next level.
- Browse 19 achievement badges across six categories:

**Words:**
- First Steps -- Review your first word
- Getting Started -- Add 10 words
- Word Collector -- Add 50 words
- Vocabulary Master -- Add 200 words
- Polyglot -- Add 500 words

**Streaks:**
- Consistent -- 3-day streak
- Dedicated -- 7-day streak
- Committed -- 30-day streak
- Unstoppable -- 100-day streak

**Sessions:**
- Quick Learner -- Complete 10 review sessions
- Study Machine -- Complete 50 sessions
- Scholar -- Complete 100 sessions

**Accuracy:**
- Sharp Mind -- 80% accuracy over 50+ reviews
- Perfectionist -- 95% accuracy over 100+ reviews

**Tools:**
- Explorer -- Try 5 different tools
- Multi-Tasker -- Try all tools in one day (at least 5 different study tools)

**Special:**
- Pre-Learner -- Use the Pre-Learn pipeline once
- Writer -- Complete a writing exercise
- Listener -- Complete a listening exercise

Earned badges show in color with the date earned; locked badges are grayed out with the requirement displayed.

**Tips:**
- Achievements are a great motivator for trying new tools. Go for "Explorer" early by visiting 5 different practice tools.
- The streak badges reward consistency -- even a 5-minute session counts toward your streak.
- XP is calculated from reviews, sessions, streaks, and achievements earned.

---

### 20. Progress Dashboard

**What it does:** A comprehensive view of your learning statistics with charts, streaks, and session history.

**How to use it:**
- **Stats overview** -- Four cards at the top show Total Words, Learned Words, Words Due for Review, and Overall Accuracy.
- **Streak display** -- See your current streak and longest streak.
- **Activity heatmap** -- A calendar-style view showing your daily study activity. Darker squares mean more activity.
- **Charts** -- Visualize your review count, accuracy, and new words over time.
- **Session history** -- A chronological list of your recent study sessions showing tool used, words reviewed, accuracy, and duration.
- **List overview** -- See all your vocabulary lists with word counts. Click a list to jump to the Word Bank filtered by that list.

**Tips:**
- Check the Progress Dashboard weekly to spot trends. Is your accuracy improving? Are you adding new words consistently?
- The "Words Due for Review" counter is important -- if it climbs too high, focus on flashcard sessions to bring it down.
- Use the session history to make sure you are using a variety of tools, not just flashcards.

---

### 21. Settings

**What it does:** Manage your profile, preferences, data, and app configuration.

**How to use it:**

- **Profile** -- Set your display name (shown on the leaderboard and in the community).
- **Daily goal** -- Adjust your daily study time target (5, 10, 15, 20, 30, or 50 minutes).
- **Auto-play TTS** -- Toggle whether text-to-speech plays automatically during exercises.
- **Default languages** -- Set your default source and target languages so you do not have to pick them every time.
- **Export all data** -- Download everything (words, lists, stats, preferences) as a JSON file. Use this for backups.
- **Import data** -- Restore from a previously exported JSON backup.
- **Reset progress** -- Clear all review data while keeping your words (use with caution).
- **Reset onboarding** -- Re-run the onboarding wizard to change your language, level, or goals.

**Tips:**
- Export your data regularly as a backup. The export is a single JSON file that contains everything.
- If you are switching devices, export on the old device and import on the new one.
- Adjusting your daily goal is fine -- start small (5-10 minutes) and increase as the habit forms.

---

## Chrome Extension (Copilot)

The Lingua Copilot Chrome Extension brings vocabulary lookup and capture to any webpage you visit.

### Installation

1. Open Chrome and go to `chrome://extensions`.
2. Enable "Developer mode" (toggle in the top-right corner).
3. Click "Load unpacked" and select the Lingua extension directory.
4. The Lingua icon appears in your browser toolbar.

### Features

**Double-click word lookup:** Double-click any word on any webpage to see an instant popup with its translation, part of speech, and whether it is already in your Word Bank.

**Right-click "Add to Lingua":** Right-click any selected text and choose "Add to Lingua" from the context menu. The word (or phrase) is added directly to your Word Bank without leaving the page.

**Highlight mode:** Toggle highlight mode from the extension icon. When active, all words on the current page are color-coded based on whether they are in your Word Bank -- known words in one color, unknown words in another. This is like Reading Assist, but for any webpage.

**Connection to the main app:** The extension communicates with your running Lingua instance. Words added through the extension appear immediately in your Word Bank and are available for flashcard review.

### Tips

- The extension is especially powerful for reading news articles, blogs, or social media in your target language. Add unknown words as you encounter them, then study them later with flashcards.
- Use highlight mode to quickly assess whether a webpage is at the right reading level for you.
- Make sure Lingua is running (npm run dev) for the extension to connect and sync words.

---

## For Teachers

### Setting Up a Class

1. Go to the **Teacher Portal** tool.
2. Click **+ New Class**.
3. Fill in the class name (e.g., "German 201 - Spring 2026"), an optional description, and select the language pair.
4. Click Create. Lingua generates a unique **join code** -- a short alphanumeric code students use to join your class.

### Sharing the Join Code

Give the join code to your students. They enter it in their own Lingua app to join your class. No email addresses or accounts needed -- the code is all they need.

### Creating Assignments

1. Open your class in the Teacher Portal.
2. Click **Create Assignment**.
3. Select a vocabulary list to assign (you can use one of your existing lists or create a new one in the Upload tool first).
4. Set a **deadline** for when students should complete the assignment.
5. Set **completion criteria** (e.g., review all words at least once, achieve 80% accuracy).

When a list has a deadline, students see a countdown banner in their Flashcards tool, and Cram Mode becomes available for last-minute preparation.

### Tracking Student Progress

In the class detail view, you can see:
- How many students have joined.
- Each student's progress on assignments (words reviewed, accuracy, completion status).
- Overall class statistics.

### Sharing Word Lists with the Community

You can share any of your vocabulary lists with the broader Lingua community:
1. Go to the Community tool.
2. Navigate to the Shared Lists tab.
3. Share a list so other teachers and learners can import it.

This is a great way to collaborate with other teachers or provide supplementary materials to students.

---

## Tips and Shortcuts

### Keyboard Shortcuts

Press **?** at any time (when not in an input field) to see the full shortcuts list.

| Shortcut | Action |
|----------|--------|
| `Alt+1` through `Alt+9` | Jump to tools 1-9 (Home, Word Bank, Upload, Flashcards, Pre-Learn, Match, Fill Blank, Quiz, Speaking) |
| `Alt+H` | Jump to Home |
| `Alt+F` | Jump to Flashcards |
| `Alt+U` | Jump to Upload |
| `Space` | Flip flashcard (during review) |
| `1` / `2` / `3` / `4` | Rate flashcard: Again / Hard / Good / Easy (after flipping) |
| `?` | Toggle keyboard shortcuts help |
| `Escape` | Close modals and popups |

Shortcuts are automatically disabled when you are typing in an input field or text area, so they will not interfere with your writing.

### Best Practices for Daily Study

A solid 15-20 minute daily routine might look like this:

1. **Start at Home** (1 minute) -- Check your streak, see what is due, and read the suggestions.
2. **Flashcard review** (8-10 minutes) -- Work through all due cards. Rate honestly -- it is better to press "Again" on a tough word than to inflate your scores.
3. **One practice activity** (5-8 minutes) -- Rotate between Match Game, Fill in the Blank, Quiz, Sentence Cloze, or Writing. Variety keeps things interesting and reinforces words through different skills.
4. **Check Progress** (1 minute) -- Glance at the Progress Dashboard to see your streak and accuracy trends.

### How to Use Pre-Learn for Upcoming Readings or Exams

**For a reading assignment:**
1. Copy the text (article, chapter, story) you need to read.
2. Open Pre-Learn, paste it, and click Analyze.
3. Review the comprehension estimate. If it is below 80%, create a study set from the unknown words.
4. Study the unknown words with Flashcards until you feel confident.
5. Read the text using Reading Assist for interactive support.

**For an exam:**
1. Upload or generate vocabulary for the exam topics.
2. Set a deadline on the list (the exam date).
3. Study daily with Flashcards. As the deadline approaches, enable Cram Mode to review all words, not just due ones.
4. Use Sentence Cloze and Fill in the Blank for extra practice.
5. Generate a printable quiz from the Word Bank for a final paper-based practice test.

### Export and Import for Backup

- Go to **Settings** and click **Export All Data**. This downloads a JSON file with everything: words, lists, review history, preferences, and stats.
- To restore, click **Import Data** in Settings and select your backup file.
- Consider exporting weekly, especially before making major changes to your word lists.

---

That covers everything Lingua has to offer. The most important thing is consistency -- even a few minutes of study each day adds up to real progress over time. Happy learning!
