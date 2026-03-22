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
  | 'speedtyping'
  | 'wordassociation'
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
  | 'rsvp'
  | 'scenarios'
  | 'documents'
  | 'journey'
  | 'dreamjournal'
  | 'pronunciationlab'
  | 'keyboardtrainer'
  | 'skit-trainer'
  | 'reading-prep'
  | 'sentence-creator'
  | 'vocab-lifecycle'
  // Hub views (Practice sub-category landing pages)
  | 'reading-hub'
  | 'writing-hub'
  | 'speaking-hub'
  | 'listening-hub'
  | 'games-hub'

export type ToolCategory = 'home' | 'practice' | 'library' | 'community'

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
  { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F', description: 'Profile and preferences', category: 'home' },

  // --- Practice: Hub views (sidebar-level entries) ---
  { id: 'reading-hub', label: 'Reading', icon: '\u{1F4D6}', description: 'Reading practice tools', category: 'practice', practiceGroup: 'reading' },
  { id: 'writing-hub', label: 'Writing', icon: '\u270D\uFE0F', description: 'Writing practice tools', category: 'practice', practiceGroup: 'writing' },
  { id: 'speaking-hub', label: 'Speaking', icon: '\u{1F5E3}\uFE0F', description: 'Speaking practice tools', category: 'practice', practiceGroup: 'speaking' },
  { id: 'listening-hub', label: 'Listening', icon: '\u{1F442}', description: 'Listening practice tools', category: 'practice', practiceGroup: 'listening' },
  { id: 'games-hub', label: 'Games', icon: '\u{1F3AE}', description: 'Practice games', category: 'practice', practiceGroup: 'games' },

  // --- Practice: Reading tools (rendered inside ReadingHub) ---
  { id: 'prelearn', label: 'Pre-Learn', icon: '\u{1F3AF}', description: 'Prepare for a text by learning unknown words first', category: 'practice', practiceGroup: 'reading' },
  { id: 'stories', label: 'Stories', icon: '\u{1F4D5}', description: 'AI-generated graded reading', category: 'practice', practiceGroup: 'reading' },
  { id: 'cloze', label: 'Sentence Cloze', icon: '\u{1F4DD}', description: 'Fill in missing words in context sentences', category: 'practice', practiceGroup: 'reading' },
  { id: 'reading', label: 'Reading', icon: '\u{1F4D6}', description: 'Interactive text reading', category: 'practice', practiceGroup: 'reading' },
  { id: 'rsvp', label: 'Speed Reader', icon: '\u{26A1}', description: 'RSVP speed reading with unknown word detection', category: 'practice', practiceGroup: 'reading' },
  { id: 'documents', label: 'Documents', icon: '\u{1F4C4}', description: 'Read real-world documents with vocabulary help', category: 'practice', practiceGroup: 'reading' },
  { id: 'skit-trainer', label: 'Memorize', icon: '\u{1F3AD}', description: 'Memorize poems, songs, dialogues, and speeches', category: 'practice', practiceGroup: 'reading' },
  { id: 'reading-prep', label: 'Reading Prep', icon: '\u{1F4CB}', description: 'Prepare for reading by learning unknown words first', category: 'practice', practiceGroup: 'reading' },

  // --- Practice: Writing tools ---
  { id: 'writing', label: 'Writing', icon: '\u270D\uFE0F', description: 'Practice writing with AI correction', category: 'practice', practiceGroup: 'writing' },
  { id: 'phrases', label: 'Phrases', icon: '\u{1F4AC}', description: 'Practice real-world phrase scenarios', category: 'practice', practiceGroup: 'writing' },
  { id: 'dreamjournal', label: 'Dream Journal', icon: '\u{1F4D4}', description: 'Daily writing practice with vocabulary analysis', category: 'practice', practiceGroup: 'writing' },

  // --- Practice: Speaking tools ---
  { id: 'speaking', label: 'Speaking', icon: '\u{1F5E3}\uFE0F', description: 'Pronunciation & conversation', category: 'practice', practiceGroup: 'speaking' },
  { id: 'pronunciationlab', label: 'Pronunciation Lab', icon: '\u{1F399}\uFE0F', description: 'Record, compare, and improve pronunciation', category: 'practice', practiceGroup: 'speaking' },
  { id: 'scenarios', label: 'Scenarios', icon: '\u{1F3AF}', description: 'Survival phrases for real-world situations', category: 'practice', practiceGroup: 'speaking' },

  // --- Practice: Listening tools ---
  { id: 'listening', label: 'Listening', icon: '\u{1F442}', description: 'Hear words and type what you hear', category: 'practice', practiceGroup: 'listening' },

  // --- Practice: Games ---
  { id: 'match', label: 'Match', icon: '\u{1F517}', description: 'Match words to translations', category: 'practice', practiceGroup: 'games' },
  { id: 'fillblank', label: 'Fill Blank', icon: '\u270F\uFE0F', description: 'Complete the sentence', category: 'practice', practiceGroup: 'games' },
  { id: 'multichoice', label: 'Quiz', icon: '\u2753', description: 'Multiple choice quiz', category: 'practice', practiceGroup: 'games' },
  { id: 'speedtyping', label: 'Speed Typing', icon: '\u{26A1}', description: 'Translate words against the clock', category: 'practice', practiceGroup: 'games' },
  { id: 'wordassociation', label: 'Word Association', icon: '\u{1F50D}', description: 'Find related words from your vocabulary', category: 'practice', practiceGroup: 'games' },
  { id: 'flashcards', label: 'Flashcards', icon: '\u{1F0CF}', description: 'Spaced repetition review', category: 'practice', practiceGroup: 'games' },
  { id: 'keyboardtrainer', label: 'Keyboard', icon: '\u{2328}\uFE0F', description: 'Practice typing in target language', category: 'practice', practiceGroup: 'games' },
  { id: 'vocab-lifecycle', label: 'Vocab Lifecycle', icon: '\u{1F331}', description: 'Take new words from introduction to mastery in 4 stages', category: 'practice', practiceGroup: 'games' },

  // --- Library ---
  { id: 'wordbank', label: 'Word Bank', icon: '\u{1F4DA}', description: 'Browse & manage vocabulary', category: 'library' },
  { id: 'upload', label: 'Upload', icon: '\u{1F4E4}', description: 'Import vocabulary lists', category: 'library' },
  { id: 'media', label: 'Media Library', icon: '\u{1F3AD}', description: 'Import poems, songs, skits & texts to learn from', category: 'library' },
  { id: 'universe', label: 'Universe', icon: '\u{1F30C}', description: 'Your vocabulary galaxy', category: 'library' },
  { id: 'grammar', label: 'Grammar', icon: '\u{1F4D0}', description: 'AI-generated grammar lessons with exercises', category: 'library' },
  { id: 'journey', label: 'Journey', icon: '\u{1F5FA}\uFE0F', description: 'Your learning path and milestones', category: 'library' },
  { id: 'achievements', label: 'Achievements', icon: '\u{1F3C6}', description: 'Badges, XP, and milestones', category: 'library' },
  { id: 'dashboard', label: 'Progress', icon: '\u{1F4CA}', description: 'Track your learning', category: 'library' },
  { id: 'feedback-admin', label: 'Feedback', icon: '\u{1F4CB}', description: 'View user feedback & analytics', category: 'library' },
  { id: 'sentence-creator', label: 'Sentence Creator', icon: '\u270D\uFE0F', description: 'Create sentences, exercises & worksheets from vocabulary', category: 'library' },

  // --- Community ---
  { id: 'community', label: 'Community', icon: '\u{1F30D}', description: 'Leaderboard, shared lists, friends', category: 'community' },
  { id: 'teacher', label: 'School', icon: '\u{1F3EB}', description: 'Manage classes & assignments', category: 'community' },
]

/** Practice group display config */
export const PRACTICE_GROUPS: { key: PracticeGroup; label: string; icon: string }[] = [
  { key: 'reading', label: 'Reading', icon: '\u{1F4D6}' },
  { key: 'writing', label: 'Writing', icon: '\u270D\uFE0F' },
  { key: 'speaking', label: 'Speaking', icon: '\u{1F5E3}\uFE0F' },
  { key: 'listening', label: 'Listening', icon: '\u{1F442}' },
  { key: 'games', label: 'Games', icon: '\u{1F3AE}' },
]

/** Hub tool IDs that serve as practice category landing pages */
export const PRACTICE_HUB_IDS: LinguaToolId[] = [
  'reading-hub', 'writing-hub', 'speaking-hub', 'listening-hub', 'games-hub',
]

/** Map from hub ID to the individual tool IDs it contains */
export const HUB_TOOL_MAP: Record<string, LinguaToolId[]> = {
  'reading-hub':   ['prelearn', 'stories', 'cloze', 'reading', 'rsvp', 'documents', 'skit-trainer', 'reading-prep'],
  'writing-hub':   ['writing', 'dreamjournal', 'phrases'],
  'speaking-hub':  ['speaking', 'scenarios', 'pronunciationlab'],
  'listening-hub': ['listening'],
  'games-hub':     ['flashcards', 'match', 'fillblank', 'multichoice', 'speedtyping', 'wordassociation', 'keyboardtrainer', 'vocab-lifecycle'],
}
