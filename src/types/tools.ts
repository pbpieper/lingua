export type LinguaToolId =
  | 'home'
  | 'wordbank'
  | 'upload'
  | 'media'
  | 'flashcards'
  | 'match'
  | 'fillblank'
  | 'multichoice'
  | 'speaking'
  | 'reading'
  | 'prelearn'
  | 'listening'
  | 'writing'
  | 'cloze'
  | 'stories'
  | 'grammar'
  | 'phrases'
  | 'universe'
  | 'teacher'
  | 'community'
  | 'achievements'
  | 'dashboard'
  | 'feedback-admin'
  | 'settings'

export type ToolCategory = 'home' | 'practice' | 'track' | 'social'

/** Practice sub-groups for the sidebar */
export type PracticeGroup = 'reading' | 'writing' | 'speaking' | 'listening' | 'games'

export interface ToolDef {
  id: LinguaToolId
  label: string
  icon: string
  description: string
  category: ToolCategory
  /** Which practice sub-group this tool belongs to (only for category=practice) */
  practiceGroup?: PracticeGroup
}

export const TOOLS: ToolDef[] = [
  // --- Home ---
  { id: 'home', label: 'Home', icon: '\u{1F3E0}', description: 'Daily review hub', category: 'home' },
  { id: 'wordbank', label: 'Word Bank', icon: '\u{1F4DA}', description: 'Browse & manage vocabulary', category: 'home' },
  { id: 'upload', label: 'Upload', icon: '\u{1F4E4}', description: 'Import vocabulary lists', category: 'home' },
  { id: 'media', label: 'Media Library', icon: '\u{1F3AD}', description: 'Import poems, songs, skits & texts to learn from', category: 'home' },
  { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F', description: 'Profile and preferences', category: 'home' },

  // --- Practice: Reading ---
  { id: 'prelearn', label: 'Pre-Learn', icon: '\u{1F3AF}', description: 'Prepare for a text by learning unknown words first', category: 'practice', practiceGroup: 'reading' },
  { id: 'stories', label: 'Stories', icon: '\u{1F4D5}', description: 'AI-generated graded reading', category: 'practice', practiceGroup: 'reading' },
  { id: 'cloze', label: 'Sentence Cloze', icon: '\u{1F4DD}', description: 'Fill in missing words in context sentences', category: 'practice', practiceGroup: 'reading' },
  { id: 'reading', label: 'Reading', icon: '\u{1F4D6}', description: 'Interactive text reading', category: 'practice', practiceGroup: 'reading' },

  // --- Practice: Writing ---
  { id: 'writing', label: 'Writing', icon: '\u270D\uFE0F', description: 'Practice writing with AI correction', category: 'practice', practiceGroup: 'writing' },
  { id: 'phrases', label: 'Phrases', icon: '\u{1F4AC}', description: 'Practice real-world phrase scenarios', category: 'practice', practiceGroup: 'writing' },

  // --- Practice: Speaking ---
  { id: 'speaking', label: 'Speaking', icon: '\u{1F5E3}\uFE0F', description: 'Pronunciation & conversation', category: 'practice', practiceGroup: 'speaking' },

  // --- Practice: Listening ---
  { id: 'listening', label: 'Listening', icon: '\u{1F442}', description: 'Hear words and type what you hear', category: 'practice', practiceGroup: 'listening' },

  // --- Practice: Games ---
  { id: 'match', label: 'Match', icon: '\u{1F517}', description: 'Match words to translations', category: 'practice', practiceGroup: 'games' },
  { id: 'fillblank', label: 'Fill Blank', icon: '\u270F\uFE0F', description: 'Complete the sentence', category: 'practice', practiceGroup: 'games' },
  { id: 'multichoice', label: 'Quiz', icon: '\u2753', description: 'Multiple choice quiz', category: 'practice', practiceGroup: 'games' },
  { id: 'flashcards', label: 'Flashcards', icon: '\u{1F0CF}', description: 'Spaced repetition review', category: 'practice', practiceGroup: 'games' },

  // --- Track ---
  { id: 'dashboard', label: 'Progress', icon: '\u{1F4CA}', description: 'Track your learning', category: 'track' },
  { id: 'universe', label: 'Universe', icon: '\u{1F30C}', description: 'Your vocabulary galaxy', category: 'track' },
  { id: 'achievements', label: 'Achievements', icon: '\u{1F3C6}', description: 'Badges, XP, and milestones', category: 'track' },
  { id: 'grammar', label: 'Grammar', icon: '\u{1F4D0}', description: 'AI-generated grammar lessons with exercises', category: 'track' },
  { id: 'feedback-admin', label: 'Feedback', icon: '\u{1F4CB}', description: 'View user feedback & analytics', category: 'track' },

  // --- Social ---
  { id: 'teacher', label: 'Teacher', icon: '\u{1F3EB}', description: 'Manage classes & assignments', category: 'social' },
  { id: 'community', label: 'Community', icon: '\u{1F30D}', description: 'Leaderboard, shared lists, friends', category: 'social' },
]

/** Practice group display config */
export const PRACTICE_GROUPS: { key: PracticeGroup; label: string; icon: string }[] = [
  { key: 'reading', label: 'Reading', icon: '\u{1F4D6}' },
  { key: 'writing', label: 'Writing', icon: '\u270D\uFE0F' },
  { key: 'speaking', label: 'Speaking', icon: '\u{1F5E3}\uFE0F' },
  { key: 'listening', label: 'Listening', icon: '\u{1F442}' },
  { key: 'games', label: 'Games', icon: '\u{1F3AE}' },
]
