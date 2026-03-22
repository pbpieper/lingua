# Lingua

AI-powered language learning platform with flashcards, games, speaking practice, and adaptive learning. Master vocabulary in 15+ languages with a beautiful, responsive interface.

**Live demo:** [lingua-opal.vercel.app](https://lingua-opal.vercel.app)

![Lingua Screenshot](docs/screenshot-placeholder.png)

## Quick Start

```bash
npm install
npm run dev    # Vite dev server on :5173
npm run build  # Production build (tsc + vite)
```

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast dev/build
- **Tailwind CSS v4** with CSS custom properties design system
- **Framer Motion** for animations
- **Supabase** for optional cloud persistence
- **Ollama** (via Creative Hub) for AI-powered vocabulary generation
- **Web Speech API** for TTS and pronunciation practice

## Features

### Core Learning
- **Flashcards** with SM-2 spaced repetition algorithm
- **Vocabulary Upload** from CSV, text, or AI-generated packs
- **Word Bank** with search, tagging, and mastery tracking

### Practice Games
- **Match Game** (memory, column connect, image match)
- **Fill in the Blank** with adaptive difficulty
- **Multiple Choice** quizzes
- **Speed Typing** drills
- **Cloze** sentence completion
- **Word Association** chains

### Production Skills
- **Speaking Practice** with speech recognition
- **Listening Comprehension** exercises
- **Reading Assistant** with RSVP reader
- **Writing Practice** with AI feedback
- **Story Reader** for contextual learning
- **Grammar Lessons** with interactive exercises
- **Phrase Practice** for conversational patterns

### Tracking & Social
- **Vocabulary Dashboard** with charts and analytics
- **Vocab Universe** 3D galaxy visualization of your word network
- **Achievements** system with XP and levels
- **Community** section for shared lists
- **Teacher Portal** with printable quiz generation

### Quality of Life
- **Dark mode** with full theme support
- **Keyboard shortcuts** (Cmd+K command palette)
- **Adaptive difficulty** that adjusts to your performance
- **Offline mode** with localStorage fallback
- **Media Library** for poems, songs, and dialogues
- **Onboarding** with guided walkthrough

## Architecture

```
src/
  components/     # UI (atoms, layout, tools)
  context/        # React contexts (App, Auth)
  design/         # Design tokens & theme
  hooks/          # Custom hooks
  lib/            # Utility functions
  services/       # Data layer (API, localStorage, AI)
  types/          # TypeScript type definitions
  data/           # Seed data & starter packs
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
