/**
 * Vocabulary API client — connects to creative-hub backend.
 * All vocabulary data lives server-side in SQLite.
 */

import type { Word, WordInput, ReviewResult, VocabList, VocabSession, VocabStats } from '@/types/word'
import { getHubApiUrl, isHubConfigured } from '@/services/aiConfig'

function requireHub(path: string): string {
  const url = getHubApiUrl(path)
  if (!url) throw new Error('AI backend is not configured. Go to Settings to set up your AI backend.')
  return url
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(requireHub(path))
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(requireHub(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(requireHub(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(requireHub(path), { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
}

// --- Lists ---

export async function createList(userId: string, name: string, langFrom: string, langTo: string, description?: string): Promise<VocabList> {
  return post('/vocab/lists', { user_id: userId, name, language_from: langFrom, language_to: langTo, description })
}

export async function getLists(userId: string): Promise<VocabList[]> {
  return get(`/vocab/lists?user_id=${userId}`)
}

export async function deleteList(listId: number): Promise<void> {
  return del(`/vocab/lists/${listId}`)
}

export async function updateListDeadline(listId: number, deadline: string | null): Promise<void> {
  await put(`/vocab/lists/${listId}`, { deadline })
}

export async function getCramWords(userId: string, listId: number): Promise<Word[]> {
  return get(`/vocab/cram?user_id=${userId}&list_id=${listId}`)
}

// --- Words ---

export async function uploadWords(userId: string, listId: number, words: WordInput[]): Promise<{ added: number; skipped: number }> {
  return post('/vocab/upload', { user_id: userId, list_id: listId, words })
}

export async function getWords(userId: string, opts?: { list_id?: number; search?: string; tag?: string; limit?: number; offset?: number }): Promise<Word[]> {
  const params = new URLSearchParams({ user_id: userId })
  if (opts?.list_id) params.set('list_id', String(opts.list_id))
  if (opts?.search) params.set('search', opts.search)
  if (opts?.tag) params.set('tag', opts.tag)
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.offset) params.set('offset', String(opts.offset))
  return get(`/vocab/words?${params}`)
}

export async function getWord(wordId: number): Promise<Word> {
  return get(`/vocab/words/${wordId}`)
}

export async function updateWord(wordId: number, data: Partial<WordInput>): Promise<Word> {
  return put(`/vocab/words/${wordId}`, data)
}

export async function deleteWord(wordId: number): Promise<void> {
  return del(`/vocab/words/${wordId}`)
}

export async function resetProgress(userId: string): Promise<void> {
  return post('/vocab/reset-progress', { user_id: userId })
}

// --- Review (SM-2) ---

export async function submitReview(review: ReviewResult): Promise<Word> {
  return post('/vocab/review', review)
}

export async function getDueWords(userId: string, limit = 20): Promise<Word[]> {
  return get(`/vocab/due?user_id=${userId}&limit=${limit}`)
}

// --- Sessions ---

export async function startSession(userId: string, toolId: string, listId?: number): Promise<{ session_id: number }> {
  return post('/vocab/sessions', { user_id: userId, tool_id: toolId, list_id: listId })
}

export async function endSession(sessionId: number, data: { words_reviewed: number; correct: number; wrong: number; score_data?: Record<string, unknown> }): Promise<void> {
  await put(`/vocab/sessions/${sessionId}`, data)
}

// --- Stats & Dashboard ---

export async function getStats(userId: string): Promise<VocabStats> {
  return get(`/vocab/stats?user_id=${userId}`)
}

export async function getDashboard(userId: string): Promise<{
  stats: VocabStats
  lists: VocabList[]
  recent_sessions: VocabSession[]
}> {
  return get(`/vocab/dashboard?user_id=${userId}`)
}

// --- AI Topic Vocabulary Generation ---

export async function generateTopicVocab(
  topic: string,
  languageFrom: string,
  languageTo: string,
  level: string = 'A2',
  count: number = 15
): Promise<WordInput[]> {
  return post('/vocab/generate-topic', {
    topic,
    language_from: languageFrom,
    language_to: languageTo,
    level,
    count,
  })
}

// --- AI Enrichment ---

export async function enrichWords(wordIds: number[]): Promise<{ enriched: number }> {
  return post('/vocab/enrich', { word_ids: wordIds })
}

// --- Text Analysis (Pre-Learn Pipeline) ---

export interface TextAnalysis {
  total_words: number
  unique_words: number
  known_count: number
  unknown_count: number
  known_words: string[]
  unknown_words: Array<{
    lemma: string
    translation: string
    part_of_speech?: string
    gender?: string
  }>
  comprehension_estimate: number
}

export async function analyzeText(
  userId: string,
  text: string,
  languageFrom: string,
  languageTo: string,
  autoTranslate: boolean = true
): Promise<TextAnalysis> {
  return post('/vocab/analyze', {
    user_id: userId,
    text,
    language_from: languageFrom,
    language_to: languageTo,
    auto_translate: autoTranslate,
  })
}

// --- Writing Check ---

export interface WritingCheck {
  corrected_text: string
  errors: Array<{
    original: string
    correction: string
    explanation: string
    type: string
  }>
  score: number
  feedback: string
}

export async function checkWriting(
  userId: string,
  text: string,
  language: string,
  promptText: string = ''
): Promise<WritingCheck> {
  return post('/vocab/check-writing', {
    user_id: userId,
    text,
    language,
    prompt_text: promptText,
  })
}

// --- TTS (Text-to-Speech) ---

export async function generateSpeech(text: string): Promise<{ job_id: number }> {
  return post('/generate/speech', { text, voice: 'default' })
}

export async function getJobStatus(jobId: number): Promise<{ id: number; status: string; output_file?: string }> {
  return get(`/jobs/${jobId}`)
}

export function getJobOutputUrl(jobId: number): string {
  return requireHub(`/jobs/${jobId}/output`)
}

// --- Community & Engagement ---

export interface LeaderboardEntry {
  id: number
  user_id: string
  user_name: string
  week: string
  xp_earned: number
  words_learned: number
  streak_days: number
  accuracy: number
}

export interface SharedList {
  id: number
  list_id: number
  shared_by: string
  author_name: string
  share_code: string
  title: string | null
  description: string | null
  language_from: string
  language_to: string
  word_count: number
  likes: number
  downloads: number
  created_at: string
}

export async function getLeaderboard(week?: string): Promise<LeaderboardEntry[]> {
  const params = week ? `?week=${week}` : ''
  return get(`/community/leaderboard${params}`)
}

export async function updateLeaderboard(userId: string, data: {
  xp_earned?: number; words_learned?: number; streak_days?: number; accuracy?: number;
}): Promise<LeaderboardEntry> {
  return post('/community/leaderboard', { user_id: userId, ...data })
}

export async function shareList(listId: number, sharedBy: string, title?: string, description?: string): Promise<SharedList> {
  return post('/community/share', { list_id: listId, shared_by: sharedBy, title, description })
}

export async function getSharedLists(limit = 20, offset = 0): Promise<SharedList[]> {
  return get(`/community/shared-lists?limit=${limit}&offset=${offset}`)
}

export async function cloneSharedList(shareCode: string, userId: string): Promise<VocabList> {
  return post('/community/clone', { share_code: shareCode, user_id: userId })
}

export async function getFriends(userId: string): Promise<Array<{ friend_id: string; friend_name: string; status: string }>> {
  return get(`/community/friends?user_id=${userId}`)
}

// --- Teacher Portal ---

export interface TeacherClass {
  id: number
  teacher_id: string
  name: string
  description: string | null
  join_code: string
  language_from: string
  language_to: string
  student_count: number
  created_at: string
}

export interface Assignment {
  id: number
  class_id: number
  teacher_id: string
  title: string
  description: string | null
  list_id: number | null
  word_ids: number[]
  criteria: { min_accuracy?: number; min_reviews?: number }
  deadline: string | null
  assigned_at: string
  status: string
  total_students?: number
  completed_count?: number
  avg_accuracy?: number
}

export interface AssignmentProgress {
  id: number
  assignment_id: number
  student_id: string
  student_name?: string
  words_reviewed: number
  words_mastered: number
  accuracy: number
  time_spent_seconds: number
  completed: number
  last_activity: string | null
}

export interface StudentAssignment extends Assignment {
  class_name: string
  words_reviewed: number
  words_mastered: number
  accuracy: number
  time_spent_seconds: number
  completed: number
  last_activity: string | null
}

export async function createClass(teacherId: string, name: string, langFrom: string, langTo: string, description?: string): Promise<TeacherClass> {
  return post('/teacher/classes', { teacher_id: teacherId, name, language_from: langFrom, language_to: langTo, description })
}

export async function getClasses(teacherId: string): Promise<TeacherClass[]> {
  return get(`/teacher/classes?teacher_id=${teacherId}`)
}

export async function getClassDetail(classId: number): Promise<TeacherClass> {
  return get(`/teacher/classes/${classId}`)
}

export async function deleteClass(classId: number): Promise<void> {
  return del(`/teacher/classes/${classId}`)
}

export async function getClassStudents(classId: number): Promise<Array<{ id: string; name: string; enrolled_at: string }>> {
  return get(`/teacher/classes/${classId}/students`)
}

export async function joinClass(studentId: string, joinCode: string): Promise<TeacherClass> {
  return post('/teacher/join', { student_id: studentId, join_code: joinCode })
}

export async function createAssignment(data: {
  teacher_id: string; class_id: number; title: string; description?: string;
  list_id?: number; word_ids?: number[]; criteria?: { min_accuracy?: number; min_reviews?: number };
  deadline?: string; status?: string;
}): Promise<Assignment> {
  return post('/teacher/assignments', data)
}

export async function getAssignments(classId: number): Promise<Assignment[]> {
  return get(`/teacher/classes/${classId}/assignments`)
}

export async function getAssignmentProgress(assignmentId: number): Promise<AssignmentProgress[]> {
  return get(`/teacher/assignments/${assignmentId}/progress`)
}

export async function getStudentAssignments(studentId: string): Promise<StudentAssignment[]> {
  return get(`/teacher/student-assignments?student_id=${studentId}`)
}

export async function updateAssignmentProgress(data: {
  assignment_id: number; student_id: string;
  words_reviewed?: number; words_mastered?: number; accuracy?: number;
  time_spent_seconds?: number; completed?: number;
}): Promise<AssignmentProgress> {
  return put('/teacher/assignment-progress', data)
}

// --- Cloze / Sentence Practice ---

export interface Sentence {
  id: number
  word_id: number
  user_id: string
  sentence: string
  translation: string | null
  cloze_word: string
  cefr_level: string | null
  created_at: string
}

export async function generateSentences(userId: string, wordIds: number[], countPerWord?: number, language?: string, nativeLanguage?: string): Promise<Sentence[]> {
  return post('/vocab/sentences/generate', {
    user_id: userId, word_ids: wordIds, count_per_word: countPerWord,
    ...(language ? { language } : {}),
    ...(nativeLanguage ? { native_language: nativeLanguage } : {}),
  })
}

export async function getSentences(userId: string, wordId: number): Promise<Sentence[]> {
  return get(`/vocab/sentences?user_id=${userId}&word_id=${wordId}`)
}

export async function getClozeSet(userId: string, count?: number): Promise<Sentence[]> {
  return get(`/vocab/cloze-set?user_id=${userId}&count=${count ?? 20}`)
}

// --- Stories (AI-generated graded reading) ---

export interface StoryQuestion {
  question: string
  answer: string
}

export interface Story {
  id: number
  user_id: string
  title: string
  content: string
  topic: string | null
  difficulty: string
  language: string | null
  questions: StoryQuestion[]
  target_words?: Array<{ lemma: string; translation: string }>
  created_at: string
}

export async function generateStory(userId: string, topic: string, difficulty: string, targetWordIds?: number[], language?: string, nativeLanguage?: string): Promise<Story> {
  return post('/vocab/stories/generate', {
    user_id: userId, topic, difficulty,
    target_word_ids: targetWordIds ?? [],
    ...(language ? { language } : {}),
    ...(nativeLanguage ? { native_language: nativeLanguage } : {}),
  })
}

export async function getStories(userId: string, limit?: number): Promise<Story[]> {
  return get(`/vocab/stories?user_id=${userId}&limit=${limit ?? 20}`)
}

export async function getStory(storyId: number): Promise<Story> {
  return get(`/vocab/stories/${storyId}`)
}

// --- Grammar Lessons ---

export interface GrammarExample {
  original: string
  translation: string
  highlight: string
}

export interface GrammarExercise {
  type: 'fill' | 'translate' | 'correct' | 'choose'
  prompt: string
  answer: string
  hint?: string
  error?: string
  options?: string[]
}

export interface GrammarLesson {
  title: string
  explanation: string
  examples: GrammarExample[]
  rules: string[]
  exercises: GrammarExercise[]
}

export async function generateGrammarLesson(topic: string, language: string, level: string, nativeLanguage?: string): Promise<GrammarLesson> {
  return post('/vocab/grammar/generate', { topic, language, level, native_language: nativeLanguage })
}

// --- Phrase Scenarios ---

export interface PhraseEntry {
  phrase: string
  translation: string
  context: string
  formality: 'formal' | 'informal' | 'neutral'
}

export interface DialogueLine {
  speaker: string
  line: string
  translation: string
}

export interface PhraseScenario {
  situation: string
  phrases: PhraseEntry[]
  dialogue: DialogueLine[]
  cultural_notes: string
  key_vocabulary: Array<{ word: string; translation: string; part_of_speech: string }>
}

export async function generatePhraseScenario(
  situation: string,
  difficulty: string,
  language: string,
  nativeLanguage?: string
): Promise<PhraseScenario> {
  return post('/vocab/phrases/generate', { situation, difficulty, language, native_language: nativeLanguage })
}

// --- Health ---

export async function isAvailable(): Promise<boolean> {
  if (!isHubConfigured()) return false
  try {
    const url = getHubApiUrl('/health')
    if (!url) return false
    await fetch(url, { signal: AbortSignal.timeout(2000) })
    return true
  } catch {
    return false
  }
}
