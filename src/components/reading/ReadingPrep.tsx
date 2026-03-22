/**
 * ReadingPrep — Paste text, see what you know, learn what you don't, read with confidence.
 *
 * Three-phase flow:
 *   1. Input:    Paste text + view saved sessions
 *   2. Analysis: Comprehension stats, highlighted text, unknown word panel
 *   3. Reading:  Clean reading view with learned/skipped word highlights
 *
 * Works 100% offline. AI translation is an optional enhancement via Creative Hub.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getLocalWords } from '@/lib/localStore'
import { isHubConfigured, getHubApiUrl } from '@/services/aiConfig'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PrepSession {
  id: string
  title: string
  date: string
  text: string
  uniqueWordCount: number
  knownCount: number
  comprehension: number
  unknowns: UnknownWord[]
  learnedIds: string[]
}

interface UnknownWord {
  word: string
  normalized: string
  translation: string
  status: 'unknown' | 'learned' | 'skipped'
}

type Phase = 'input' | 'analysis' | 'reading'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LS_KEY = 'lingua-reading-prep'

/** RTL script detection */
const RTL_RE = /[\u0600-\u06FF\u0590-\u05FF\u0700-\u074F]/

/** Mini dictionary (~200 common words per language) */
const MINI_DICT: Record<string, Record<string, string>> = {
  es: {
    el:'the',la:'the',los:'the',las:'the',un:'a',una:'a',de:'of',en:'in',y:'and',que:'that',
    es:'is',no:'no',se:'self',lo:'it',por:'for',con:'with',para:'for',su:'his/her',al:'to the',
    del:'of the',como:'like',más:'more',pero:'but',yo:'I',me:'me',mi:'my',tú:'you',tu:'your',
    él:'he',ella:'she',nos:'us',este:'this',esta:'this',todo:'all',bien:'well',muy:'very',
    ser:'to be',estar:'to be',tener:'to have',hacer:'to do',ir:'to go',ver:'to see',
    dar:'to give',saber:'to know',querer:'to want',decir:'to say',poder:'can',venir:'to come',
    hay:'there is',casa:'house',hombre:'man',mujer:'woman',niño:'child',día:'day',tiempo:'time',
    agua:'water',vida:'life',mundo:'world',parte:'part',donde:'where',cuando:'when',
    también:'also',solo:'only',otro:'other',cosa:'thing',mismo:'same',después:'after',
    antes:'before',sobre:'about',entre:'between',sin:'without',hasta:'until',desde:'from',
    noche:'night',mano:'hand',ojo:'eye',grande:'big',bueno:'good',nuevo:'new',
    primero:'first',último:'last',largo:'long',poco:'little',mucho:'much',mejor:'better',
    ciudad:'city',país:'country',calle:'street',libro:'book',trabajo:'work',puerta:'door',
    gente:'people',amigo:'friend',madre:'mother',padre:'father',hermano:'brother',
    comer:'to eat',beber:'to drink',dormir:'to sleep',hablar:'to speak',leer:'to read',
    escribir:'to write',caminar:'to walk',correr:'to run',abrir:'to open',cerrar:'to close',
    blanco:'white',negro:'black',rojo:'red',azul:'blue',verde:'green',
    uno:'one',dos:'two',tres:'three',cuatro:'four',cinco:'five',
    seis:'six',siete:'seven',ocho:'eight',nueve:'nine',diez:'ten',
    sí:'yes',hola:'hello',gracias:'thanks',adiós:'goodbye',por_favor:'please',
  },
  ar: {
    'في':'in','من':'from','على':'on','إلى':'to','هذا':'this','هذه':'this','أن':'that',
    'هو':'he','هي':'she','أنا':'I','أنت':'you','نحن':'we','هم':'they','كان':'was',
    'ما':'what','لا':'no','مع':'with','عن':'about','بعد':'after','قبل':'before',
    'كل':'all','بين':'between','حتى':'until','لكن':'but','أو':'or','إذا':'if',
    'الله':'God','يوم':'day','بيت':'house','ماء':'water','أرض':'land','كتاب':'book',
    'رجل':'man','امرأة':'woman','ولد':'boy','بنت':'girl','أب':'father','أم':'mother',
    'كبير':'big','صغير':'small','جديد':'new','قديم':'old','جيد':'good',
    'واحد':'one','اثنان':'two','ثلاثة':'three','أربعة':'four','خمسة':'five',
    'نعم':'yes','شكرا':'thanks','مرحبا':'hello',
  },
  fr: {
    le:'the',la:'the',les:'the',un:'a',une:'a',de:'of',du:'of the',des:'of the',
    et:'and',en:'in',est:'is',que:'that',qui:'who',ne:'not',pas:'not',je:'I',tu:'you',
    il:'he',elle:'she',nous:'we',vous:'you',ils:'they',ce:'this',se:'self',son:'his',
    sa:'her',mon:'my',ma:'my',avec:'with',pour:'for',dans:'in',sur:'on',par:'by',
    mais:'but',ou:'or',plus:'more',tout:'all',bien:'well',très:'very',
    être:'to be',avoir:'to have',faire:'to do',dire:'to say',aller:'to go',
    voir:'to see',savoir:'to know',pouvoir:'can',venir:'to come',vouloir:'to want',
    homme:'man',femme:'woman',enfant:'child',jour:'day',temps:'time',
    maison:'house',eau:'water',vie:'life',monde:'world',pays:'country',
    ville:'city',rue:'street',livre:'book',ami:'friend',mère:'mother',père:'father',
    grand:'big',petit:'small',bon:'good',nouveau:'new',beau:'beautiful',
    manger:'to eat',boire:'to drink',dormir:'to sleep',parler:'to speak',lire:'to read',
    écrire:'to write',marcher:'to walk',ouvrir:'to open',fermer:'to close',
    blanc:'white',noir:'black',rouge:'red',bleu:'blue',vert:'green',
    un_:'one',deux:'two',trois:'three',quatre:'four',cinq:'five',
    oui:'yes',non:'no',merci:'thanks',bonjour:'hello',salut:'hi',
  },
  de: {
    der:'the',die:'the',das:'the',ein:'a',eine:'a',und:'and',ist:'is',in:'in',
    von:'from',zu:'to',den:'the',mit:'with',auf:'on',für:'for',nicht:'not',
    ich:'I',du:'you',er:'he',sie:'she/they',wir:'we',es:'it',an:'at',
    aber:'but',oder:'or',auch:'also',nur:'only',noch:'still',schon:'already',
    sein:'to be',haben:'to have',werden:'to become',können:'can',müssen:'must',
    sollen:'should',wollen:'to want',machen:'to do',gehen:'to go',kommen:'to come',
    sagen:'to say',geben:'to give',sehen:'to see',wissen:'to know',
    Mann:'man',Frau:'woman',Kind:'child',Tag:'day',Zeit:'time',
    Haus:'house',Wasser:'water',Leben:'life',Welt:'world',Land:'country',
    Stadt:'city',Buch:'book',Freund:'friend',Mutter:'mother',Vater:'father',
    groß:'big',klein:'small',gut:'good',neu:'new',alt:'old',
    essen:'to eat',trinken:'to drink',schlafen:'to sleep',sprechen:'to speak',
    lesen:'to read',schreiben:'to write',laufen:'to run',öffnen:'to open',
    weiß:'white',schwarz:'black',rot:'red',blau:'blue',grün:'green',
    eins:'one',zwei:'two',drei:'three',vier:'four',fünf:'five',
    ja:'yes',nein:'no',danke:'thanks',hallo:'hello',bitte:'please',
  },
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function normalize(w: string): string {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function isRTL(text: string): boolean {
  const sample = text.slice(0, 200)
  const rtlChars = (sample.match(RTL_RE) || []).length
  return rtlChars > sample.length * 0.3
}

function tokenize(text: string): string[] {
  return text.split(/[\s\u200B]+/).filter(Boolean)
}

function loadSessions(): PrepSession[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveSessions(sessions: PrepSession[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(sessions))
}

function detectLanguage(text: string): string | null {
  const sample = text.toLowerCase().slice(0, 500)
  if (RTL_RE.test(sample)) return 'ar'
  const es = ['el ', ' de ', ' que ', ' en ', ' los ', ' las ', ' por ', ' con ']
  const fr = ['le ', ' de ', ' que ', ' les ', ' des ', ' est ', ' une ', ' dans ']
  const de = ['der ', ' die ', ' und ', ' das ', ' ist ', ' den ', ' mit ', ' auf ']
  const scoreEs = es.filter(w => sample.includes(w)).length
  const scoreFr = fr.filter(w => sample.includes(w)).length
  const scoreDe = de.filter(w => sample.includes(w)).length
  const max = Math.max(scoreEs, scoreFr, scoreDe)
  if (max < 2) return null
  if (max === scoreEs) return 'es'
  if (max === scoreFr) return 'fr'
  return 'de'
}

function lookupWord(word: string, lang: string | null): string {
  if (!lang || !MINI_DICT[lang]) return ''
  return MINI_DICT[lang][word] || ''
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ReadingPrep() {
  const [phase, setPhase] = useState<Phase>('input')
  const [inputText, setInputText] = useState('')
  const [sessions, setSessions] = useState<PrepSession[]>(loadSessions)

  // Analysis state
  const [originalText, setOriginalText] = useState('')
  const [uniqueWords, setUniqueWords] = useState<string[]>([])
  const [knownSet, setKnownSet] = useState<Set<string>>(new Set())
  const [unknowns, setUnknowns] = useState<UnknownWord[]>([])
  const [detectedLang, setDetectedLang] = useState<string | null>(null)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const textIsRTL = useMemo(() => isRTL(originalText), [originalText])

  // Build lookup for quick status checks
  const unknownMap = useMemo(() => {
    const m = new Map<string, UnknownWord>()
    for (const u of unknowns) m.set(u.normalized, u)
    return m
  }, [unknowns])

  const comprehension = useMemo(() => {
    if (uniqueWords.length === 0) return 0
    const knownCount = uniqueWords.filter(w => knownSet.has(w)).length
    return Math.round((knownCount / uniqueWords.length) * 100)
  }, [uniqueWords, knownSet])

  /* ---- Analyze --------------------------------------------------- */

  const handleAnalyze = useCallback(() => {
    const text = inputText.trim()
    if (!text) return

    const localWords = getLocalWords()
    const knownNormalized = new Set(localWords.map(w => normalize(w.lemma)))

    const tokens = tokenize(text)
    const seen = new Set<string>()
    const uniq: string[] = []
    for (const t of tokens) {
      const n = normalize(t)
      if (n && !seen.has(n)) { seen.add(n); uniq.push(n) }
    }

    const lang = detectLanguage(text)
    setDetectedLang(lang)

    const known = new Set<string>()
    const unkList: UnknownWord[] = []
    const unkSeen = new Set<string>()

    for (const n of uniq) {
      if (knownNormalized.has(n)) {
        known.add(n)
      }
    }

    // Build unknowns in order of appearance
    for (const t of tokens) {
      const n = normalize(t)
      if (!n || known.has(n) || unkSeen.has(n)) continue
      unkSeen.add(n)
      const translation = lookupWord(n, lang)
      // Also check known words for translation
      const localMatch = localWords.find(w => normalize(w.lemma) === n)
      unkList.push({
        word: t,
        normalized: n,
        translation: localMatch?.translation || translation,
        status: 'unknown',
      })
    }

    setOriginalText(text)
    setUniqueWords(uniq)
    setKnownSet(known)
    setUnknowns(unkList)
    setSelectedWord(null)

    const sessionId = genId()
    setActiveSessionId(sessionId)
    setPhase('analysis')
  }, [inputText])

  /* ---- AI translate ---------------------------------------------- */

  const handleAITranslate = useCallback(async () => {
    if (!isHubConfigured() || unknowns.length === 0) return
    setTranslating(true)
    try {
      const wordsToTranslate = unknowns.filter(u => !u.translation).map(u => u.normalized)
      if (wordsToTranslate.length === 0) { setTranslating(false); return }

      const prompt = `Translate these words to English. Return ONLY a JSON object mapping each word to its translation. No explanation.\n\nWords: ${wordsToTranslate.join(', ')}`
      const url = getHubApiUrl('/generate/text')
      if (!url) { setTranslating(false); return }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: 'llama3.2:3b', max_tokens: 500 }),
      })
      if (!res.ok) throw new Error('AI request failed')
      const data = await res.json()

      // Parse the response text for JSON
      const responseText = data.text || data.response || ''
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const translations: Record<string, string> = JSON.parse(jsonMatch[0])
        setUnknowns(prev => prev.map(u => {
          if (!u.translation && translations[u.normalized]) {
            return { ...u, translation: translations[u.normalized] }
          }
          return u
        }))
      }
    } catch (e) {
      console.error('AI translation failed:', e)
    } finally {
      setTranslating(false)
    }
  }, [unknowns])

  /* ---- Word actions ---------------------------------------------- */

  const markLearned = useCallback((normalized: string) => {
    setUnknowns(prev => prev.map(u =>
      u.normalized === normalized ? { ...u, status: 'learned' } : u
    ))
  }, [])

  const markKnown = useCallback((normalized: string) => {
    // "I know this" — treat as already known
    setKnownSet(prev => new Set([...prev, normalized]))
    setUnknowns(prev => prev.filter(u => u.normalized !== normalized))
  }, [])

  const addToWordBank = useCallback((u: UnknownWord) => {
    try {
      const raw = localStorage.getItem('lingua-local-words')
      const words = raw ? JSON.parse(raw) : []
      // Check duplicate
      if (words.some((w: { lemma: string }) => normalize(w.lemma) === u.normalized)) {
        markLearned(u.normalized)
        return
      }
      words.push({
        id: Date.now(),
        lemma: u.word,
        translation: u.translation || '',
        language_from: detectedLang || '',
        language_to: 'en',
        tags: ['reading-prep'],
        created_at: new Date().toISOString(),
      })
      localStorage.setItem('lingua-local-words', JSON.stringify(words))
      markLearned(u.normalized)
    } catch (e) {
      console.error('Failed to add word:', e)
    }
  }, [detectedLang, markLearned])

  const addAllUnknown = useCallback(() => {
    const remaining = unknowns.filter(u => u.status === 'unknown')
    for (const u of remaining) addToWordBank(u)
  }, [unknowns, addToWordBank])

  /* ---- Save session ---------------------------------------------- */

  const saveSession = useCallback(() => {
    const session: PrepSession = {
      id: activeSessionId || genId(),
      title: originalText.slice(0, 50).replace(/\s+/g, ' ') + (originalText.length > 50 ? '...' : ''),
      date: new Date().toISOString(),
      text: originalText,
      uniqueWordCount: uniqueWords.length,
      knownCount: uniqueWords.filter(w => knownSet.has(w)).length,
      comprehension,
      unknowns,
      learnedIds: unknowns.filter(u => u.status === 'learned').map(u => u.normalized),
    }
    const updated = [session, ...sessions.filter(s => s.id !== session.id)].slice(0, 20)
    setSessions(updated)
    saveSessions(updated)
  }, [activeSessionId, originalText, uniqueWords, knownSet, comprehension, unknowns, sessions])

  /* ---- Resume session -------------------------------------------- */

  const resumeSession = useCallback((session: PrepSession) => {
    setInputText(session.text)
    setOriginalText(session.text)
    setDetectedLang(detectLanguage(session.text))
    setActiveSessionId(session.id)

    const localWords = getLocalWords()
    const knownNormalized = new Set(localWords.map(w => normalize(w.lemma)))
    // Also add words the user explicitly marked known
    const tokens = tokenize(session.text)
    const seen = new Set<string>()
    const uniq: string[] = []
    for (const t of tokens) {
      const n = normalize(t)
      if (n && !seen.has(n)) { seen.add(n); uniq.push(n) }
    }

    setUniqueWords(uniq)
    setKnownSet(knownNormalized)

    // Restore unknowns with saved status
    const learnedSet = new Set(session.learnedIds)
    setUnknowns(session.unknowns.map(u => ({
      ...u,
      status: learnedSet.has(u.normalized) ? 'learned' : knownNormalized.has(u.normalized) ? 'learned' : u.status,
    })))
    setPhase('analysis')
  }, [])

  const deleteSession = useCallback((id: string) => {
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    saveSessions(updated)
  }, [sessions])

  /* ---- Start reading --------------------------------------------- */

  const startReading = useCallback(() => {
    saveSession()
    setPhase('reading')
  }, [saveSession])

  const finishReading = useCallback(() => {
    saveSession()
    setPhase('input')
    setInputText('')
    setOriginalText('')
    setUnknowns([])
    setUniqueWords([])
    setKnownSet(new Set())
    setActiveSessionId(null)
  }, [saveSession])

  /* ---- Render text with highlights ------------------------------- */

  const renderHighlightedText = useCallback((mode: 'analysis' | 'reading') => {
    const tokens = originalText.split(/(\s+)/)
    return tokens.map((token, i) => {
      if (/^\s+$/.test(token)) return <span key={i}>{token}</span>

      const n = normalize(token)
      if (!n) return <span key={i}>{token}</span>

      const uw = unknownMap.get(n)
      if (!uw && !knownSet.has(n)) {
        // Unknown but not tracked (shouldn't happen), render plain
        return <span key={i}>{token}</span>
      }

      if (knownSet.has(n) && !uw) {
        // Known word — plain in analysis, plain in reading
        return <span key={i}>{token}</span>
      }

      if (uw) {
        if (mode === 'analysis') {
          // Orange underline, clickable
          return (
            <span
              key={i}
              onClick={() => setSelectedWord(uw.normalized === selectedWord ? null : uw.normalized)}
              className="cursor-pointer relative"
              style={{
                borderBottom: '2px solid var(--color-accent)',
                paddingBottom: '1px',
                background: selectedWord === uw.normalized ? 'var(--color-accent-light)' : undefined,
                borderRadius: '2px',
              }}
              title={uw.translation || undefined}
            >
              {token}
              {selectedWord === uw.normalized && uw.translation && (
                <span
                  className="absolute left-0 top-full mt-1 z-10 px-2 py-1 rounded text-xs whitespace-nowrap"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  }}
                >
                  {uw.translation}
                </span>
              )}
            </span>
          )
        }
        // Reading mode
        const color = uw.status === 'learned' ? 'var(--color-correct)' : 'var(--color-accent)'
        return (
          <span
            key={i}
            className="cursor-pointer relative inline-block group"
            style={{ borderBottom: `2px solid ${color}`, paddingBottom: '1px', borderRadius: '2px' }}
          >
            {token}
            {uw.translation && (
              <span
                className="absolute left-0 top-full mt-1 z-10 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}
              >
                {uw.translation}
              </span>
            )}
          </span>
        )
      }

      return <span key={i}>{token}</span>
    })
  }, [originalText, unknownMap, knownSet, selectedWord])

  /* ---- Auto-focus textarea --------------------------------------- */

  useEffect(() => {
    if (phase === 'input' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [phase])

  /* ================================================================ */
  /*  Phase 1: Input                                                   */
  /* ================================================================ */

  if (phase === 'input') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Reading Prep
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Paste the text you want to read. We will show you which words you already know and help you learn the rest.
          </p>
        </div>

        <div>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Paste the text you want to read..."
            rows={8}
            className="w-full rounded-lg px-4 py-3 text-sm resize-y"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              direction: isRTL(inputText) ? 'rtl' : 'ltr',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleAnalyze}
              disabled={!inputText.trim()}
              className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-primary-main)',
                color: '#fff',
                border: 'none',
              }}
            >
              Analyze
            </button>
            {inputText.trim() && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {tokenize(inputText).length} words
              </span>
            )}
          </div>
        </div>

        {/* Saved sessions */}
        {sessions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Saved Sessions
            </h3>
            <div className="space-y-2">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 group"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <button
                    onClick={() => resumeSession(s)}
                    className="flex-1 text-left cursor-pointer bg-transparent border-none p-0"
                  >
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {s.title}
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      <span>{new Date(s.date).toLocaleDateString()}</span>
                      <span>{s.uniqueWordCount} words</span>
                      <span
                        className="font-medium"
                        style={{ color: s.comprehension >= 80 ? 'var(--color-correct)' : s.comprehension >= 50 ? 'var(--color-accent)' : 'var(--color-incorrect)' }}
                      >
                        {s.comprehension}% known
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded cursor-pointer transition-opacity bg-transparent border-none"
                    style={{ color: 'var(--color-text-muted)' }}
                    aria-label="Delete session"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ================================================================ */
  /*  Phase 2: Analysis                                                */
  /* ================================================================ */

  if (phase === 'analysis') {
    const unknownCount = unknowns.length
    const learnedCount = unknowns.filter(u => u.status === 'learned').length
    const selectedUnknown = unknowns.find(u => u.normalized === selectedWord)
    const untranslatedCount = unknowns.filter(u => !u.translation && u.status === 'unknown').length

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Analysis
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Click highlighted words to see translations
            </p>
          </div>
          <button
            onClick={() => { setPhase('input') }}
            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer"
            style={{
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Back
          </button>
        </div>

        {/* Comprehension bar */}
        <div
          className="rounded-lg px-4 py-3"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between text-sm mb-2">
            <span style={{ color: 'var(--color-text-secondary)' }}>
              You know <strong>{uniqueWords.length - unknownCount}</strong> of <strong>{uniqueWords.length}</strong> unique words
            </span>
            <span
              className="font-semibold"
              style={{
                color: comprehension >= 80 ? 'var(--color-correct)' : comprehension >= 50 ? 'var(--color-accent)' : 'var(--color-incorrect)',
              }}
            >
              {comprehension}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-gray-200)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${comprehension}%`,
                background: comprehension >= 80 ? 'var(--color-correct)' : comprehension >= 50 ? 'var(--color-accent)' : 'var(--color-incorrect)',
              }}
            />
          </div>
          {learnedCount > 0 && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-correct)' }}>
              +{learnedCount} word{learnedCount !== 1 ? 's' : ''} learned this session
            </p>
          )}
        </div>

        {/* Main content: text + sidebar */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Text area */}
          <div
            className="flex-1 rounded-lg px-4 py-3 text-sm leading-relaxed overflow-auto"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              direction: textIsRTL ? 'rtl' : 'ltr',
              maxHeight: '400px',
              lineHeight: '1.8',
            }}
          >
            {renderHighlightedText('analysis')}
          </div>

          {/* Unknown words panel */}
          <div
            className="md:w-72 rounded-lg overflow-hidden flex flex-col"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              maxHeight: '400px',
            }}
          >
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Unknown ({unknownCount - learnedCount})
              </span>
              <div className="flex gap-1.5">
                {isHubConfigured() && untranslatedCount > 0 && (
                  <button
                    onClick={handleAITranslate}
                    disabled={translating}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer"
                    style={{
                      background: 'var(--color-primary-faded)',
                      color: 'var(--color-primary-main)',
                      border: 'none',
                    }}
                  >
                    {translating ? 'Translating...' : 'AI Translate'}
                  </button>
                )}
                {unknowns.some(u => u.status === 'unknown') && (
                  <button
                    onClick={addAllUnknown}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer"
                    style={{
                      background: 'var(--color-correct-bg)',
                      color: 'var(--color-correct)',
                      border: 'none',
                    }}
                  >
                    Add All
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {unknowns.map(u => (
                <div
                  key={u.normalized}
                  className="flex items-center gap-2 px-3 py-2"
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    opacity: u.status === 'learned' ? 0.5 : 1,
                    background: selectedWord === u.normalized ? 'var(--color-accent-light)' : undefined,
                  }}
                >
                  <button
                    onClick={() => setSelectedWord(u.normalized === selectedWord ? null : u.normalized)}
                    className="flex-1 text-left bg-transparent border-none p-0 cursor-pointer"
                    style={{ direction: textIsRTL ? 'rtl' : 'ltr' }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {u.word}
                    </span>
                    {u.translation ? (
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                        {u.translation}
                      </span>
                    ) : (
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>?</span>
                    )}
                  </button>
                  {u.status === 'unknown' && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => addToWordBank(u)}
                        className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                        style={{
                          background: 'var(--color-primary-faded)',
                          color: 'var(--color-primary-main)',
                          border: 'none',
                        }}
                        title="Add to word bank"
                      >
                        +
                      </button>
                      <button
                        onClick={() => markKnown(u.normalized)}
                        className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                        style={{
                          background: 'var(--color-surface-alt)',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)',
                        }}
                        title="I know this word"
                      >
                        Know
                      </button>
                    </div>
                  )}
                  {u.status === 'learned' && (
                    <span className="text-[10px]" style={{ color: 'var(--color-correct)' }}>Added</span>
                  )}
                </div>
              ))}
              {unknowns.length === 0 && (
                <p className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  You know all the words!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Word detail popover for mobile */}
        {selectedUnknown && (
          <div
            className="md:hidden rounded-lg px-4 py-3"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div style={{ direction: textIsRTL ? 'rtl' : 'ltr' }}>
                <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {selectedUnknown.word}
                </span>
                {selectedUnknown.translation ? (
                  <span className="text-sm ml-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {selectedUnknown.translation}
                  </span>
                ) : (
                  <span className="text-sm ml-3" style={{ color: 'var(--color-text-muted)' }}>No translation</span>
                )}
              </div>
              {selectedUnknown.status === 'unknown' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => addToWordBank(selectedUnknown)}
                    className="text-xs px-3 py-1 rounded cursor-pointer"
                    style={{ background: 'var(--color-primary-main)', color: '#fff', border: 'none' }}
                  >
                    Add to bank
                  </button>
                  <button
                    onClick={() => markKnown(selectedUnknown.normalized)}
                    className="text-xs px-3 py-1 rounded cursor-pointer"
                    style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    I know this
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={startReading}
            className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-primary-main)', color: '#fff', border: 'none' }}
          >
            Start Reading
          </button>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {learnedCount} learned, {unknowns.filter(u => u.status === 'unknown').length} remaining
          </span>
        </div>
      </div>
    )
  }

  /* ================================================================ */
  /*  Phase 3: Reading                                                 */
  /* ================================================================ */

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Reading
        </h2>
        <button
          onClick={() => setPhase('analysis')}
          className="text-xs px-3 py-1.5 rounded-lg cursor-pointer"
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          Back to Analysis
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Hover over highlighted words to see translations.
        <span style={{ color: 'var(--color-correct)', marginLeft: '8px' }}>Green</span> = learned,
        <span style={{ color: 'var(--color-accent)', marginLeft: '8px' }}>Orange</span> = skipped
      </p>

      <div
        className="rounded-lg px-5 py-4 text-base leading-loose"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          direction: textIsRTL ? 'rtl' : 'ltr',
          lineHeight: '2',
        }}
      >
        {renderHighlightedText('reading')}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={finishReading}
          className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
          style={{ background: 'var(--color-correct)', color: '#fff', border: 'none' }}
        >
          Reading Complete
        </button>
        <button
          onClick={() => setPhase('analysis')}
          className="px-4 py-2 rounded-lg text-sm cursor-pointer"
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          Review Words
        </button>
      </div>
    </div>
  )
}
