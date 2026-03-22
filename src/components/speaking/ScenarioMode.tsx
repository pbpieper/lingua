import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Scenario Data
// ---------------------------------------------------------------------------

interface ScenarioPhrase {
  situation: string
  phrase: string
  translation: string
  phonetic?: string
}

interface Scenario {
  id: string
  title: string
  icon: string
  description: string
  phrases: ScenarioPhrase[]
}

const SCENARIOS: Scenario[] = [
  {
    id: 'airport', title: 'Airport', icon: '\u2708\uFE0F',
    description: 'Navigate check-in, security, and boarding',
    phrases: [
      { situation: 'You need to find your gate', phrase: 'Where is gate B12?', translation: 'You need to ask for directions to your boarding gate' },
      { situation: 'Your luggage is lost', phrase: 'My luggage did not arrive. Can you help me?', translation: 'Report missing baggage at the airline counter' },
      { situation: 'You need to check in', phrase: 'I would like to check in for my flight.', translation: 'Approach the check-in desk' },
      { situation: 'You need a boarding pass', phrase: 'Can I have my boarding pass, please?', translation: 'Request your boarding document' },
      { situation: 'You are going through security', phrase: 'Do I need to remove my shoes?', translation: 'Ask about security procedures' },
      { situation: 'Your flight is delayed', phrase: 'When is the new departure time?', translation: 'Ask about updated schedule' },
      { situation: 'You need to change your seat', phrase: 'Is it possible to change my seat?', translation: 'Request a different seat assignment' },
      { situation: 'You need a taxi', phrase: 'Where can I find a taxi?', translation: 'Ask for ground transportation' },
    ],
  },
  {
    id: 'hospital', title: 'Hospital', icon: '\uD83C\uDFE5',
    description: 'Medical emergencies and appointments',
    phrases: [
      { situation: 'You need emergency help', phrase: 'I need a doctor immediately!', translation: 'Express urgent medical need' },
      { situation: 'You are in pain', phrase: 'I have a sharp pain here.', translation: 'Describe your symptoms and location' },
      { situation: 'You need medication', phrase: 'I need my prescription filled.', translation: 'Request medication at pharmacy' },
      { situation: 'You are allergic to something', phrase: 'I am allergic to penicillin.', translation: 'Communicate important allergy information' },
      { situation: 'You need directions inside', phrase: 'Where is the emergency room?', translation: 'Find the right department' },
      { situation: 'You need to describe what happened', phrase: 'I fell and hurt my arm.', translation: 'Explain the cause of injury' },
      { situation: 'You need an appointment', phrase: 'I need to see a specialist.', translation: 'Request referral to specialist' },
      { situation: 'You need insurance information', phrase: 'Do you accept my insurance?', translation: 'Check insurance coverage' },
    ],
  },
  {
    id: 'restaurant', title: 'Restaurant', icon: '\uD83C\uDF7D\uFE0F',
    description: 'Order food, handle dietary needs, pay the bill',
    phrases: [
      { situation: 'You want a table', phrase: 'A table for two, please.', translation: 'Request seating' },
      { situation: 'You want to see the menu', phrase: 'May I see the menu, please?', translation: 'Ask for the menu' },
      { situation: 'You have dietary restrictions', phrase: 'I am vegetarian. What do you recommend?', translation: 'Communicate dietary needs' },
      { situation: 'You are ready to order', phrase: 'I would like the grilled fish, please.', translation: 'Place your order' },
      { situation: 'You want the bill', phrase: 'Can I have the check, please?', translation: 'Request the bill' },
      { situation: 'You want to leave a tip', phrase: 'Is the tip included?', translation: 'Ask about gratuity' },
      { situation: 'Something is wrong with your order', phrase: 'Excuse me, this is not what I ordered.', translation: 'Politely correct an order mistake' },
      { situation: 'You have an allergy', phrase: 'Does this contain nuts?', translation: 'Ask about allergens in food' },
    ],
  },
  {
    id: 'police', title: 'Police Station', icon: '\uD83D\uDE93',
    description: 'Report incidents and ask for help',
    phrases: [
      { situation: 'You need to report a theft', phrase: 'Someone stole my wallet.', translation: 'Report stolen property' },
      { situation: 'You are lost', phrase: 'I am lost. Can you help me find this address?', translation: 'Ask for directions' },
      { situation: 'You had an accident', phrase: 'There has been a car accident.', translation: 'Report a traffic incident' },
      { situation: 'You need your embassy', phrase: 'Where is the nearest embassy?', translation: 'Find diplomatic services' },
      { situation: 'You need to file a report', phrase: 'I need to file a police report.', translation: 'Begin official documentation' },
      { situation: 'You witnessed something', phrase: 'I saw what happened. I can help.', translation: 'Offer to be a witness' },
      { situation: 'You need legal help', phrase: 'I need to speak with a lawyer.', translation: 'Request legal counsel' },
      { situation: 'You lost your passport', phrase: 'I have lost my passport.', translation: 'Report a lost travel document' },
    ],
  },
  {
    id: 'school', title: 'School Meeting', icon: '\uD83C\uDFEB',
    description: "Talk to your child's teacher",
    phrases: [
      { situation: "You want to know about your child's progress", phrase: 'How is my child doing in class?', translation: "Ask about academic progress" },
      { situation: 'Your child is being bullied', phrase: 'My child is having problems with other students.', translation: 'Report social issues' },
      { situation: 'You need to explain an absence', phrase: 'My child was sick yesterday.', translation: 'Explain why your child missed school' },
      { situation: 'You want homework help', phrase: 'Can you explain the homework assignment?', translation: 'Get clarification on assignments' },
      { situation: 'You need schedule information', phrase: 'What time does school start?', translation: 'Ask about daily schedule' },
      { situation: 'You want to volunteer', phrase: 'I would like to help in the classroom.', translation: 'Offer to participate' },
      { situation: 'Your child needs special support', phrase: 'My child needs extra help with reading.', translation: 'Request additional support' },
      { situation: 'You need to sign up for activities', phrase: 'How can I register for after-school programs?', translation: 'Ask about extracurricular activities' },
    ],
  },
  {
    id: 'job', title: 'Job Interview', icon: '\uD83D\uDCBC',
    description: 'Present yourself professionally',
    phrases: [
      { situation: 'You introduce yourself', phrase: 'Good morning. I am here for the interview.', translation: 'Arrive and announce yourself' },
      { situation: 'You describe your experience', phrase: 'I have five years of experience in this field.', translation: 'Summarize your background' },
      { situation: 'You want to know about the role', phrase: 'What are the main responsibilities?', translation: 'Ask about job duties' },
      { situation: 'You negotiate salary', phrase: 'What is the salary range for this position?', translation: 'Discuss compensation' },
      { situation: 'You ask about benefits', phrase: 'Do you offer health insurance?', translation: 'Ask about benefits package' },
      { situation: 'You explain why you want the job', phrase: 'I am very interested in this opportunity.', translation: 'Express genuine interest' },
      { situation: 'You ask about next steps', phrase: 'When can I expect to hear back?', translation: 'Ask about the timeline' },
      { situation: 'You thank them', phrase: 'Thank you for your time. It was a pleasure meeting you.', translation: 'End the interview politely' },
    ],
  },
  {
    id: 'shopping', title: 'Shopping', icon: '\uD83D\uDED2',
    description: 'Find items, ask prices, return goods',
    phrases: [
      { situation: 'You are looking for something', phrase: 'Do you have this in a different size?', translation: 'Ask about product availability' },
      { situation: 'You want to know the price', phrase: 'How much does this cost?', translation: 'Ask for the price' },
      { situation: 'You want to try something on', phrase: 'Where is the fitting room?', translation: 'Find the changing area' },
      { situation: 'You want a discount', phrase: 'Is there a sale or discount?', translation: 'Ask about promotions' },
      { situation: 'You want to pay', phrase: 'Can I pay with a credit card?', translation: 'Ask about payment methods' },
      { situation: 'You need to return something', phrase: 'I would like to return this item.', translation: 'Process a return' },
      { situation: 'You need a bag', phrase: 'Can I have a bag, please?', translation: 'Request a shopping bag' },
      { situation: 'You need help finding something', phrase: 'Where can I find the electronics section?', translation: 'Ask for store directions' },
    ],
  },
  {
    id: 'emergency', title: 'Emergency', icon: '\uD83D\uDEA8',
    description: 'Life-threatening situations',
    phrases: [
      { situation: 'You need immediate help', phrase: 'Help! Call an ambulance!', translation: 'Request emergency services' },
      { situation: 'There is a fire', phrase: 'Fire! Everyone get out!', translation: 'Alert others to danger' },
      { situation: 'Someone is unconscious', phrase: 'This person is not breathing. Call for help!', translation: 'Report a medical emergency' },
      { situation: 'You need to give your location', phrase: 'I am at the corner of Main Street and 5th Avenue.', translation: 'Provide your location to emergency services' },
      { situation: 'You need to evacuate', phrase: 'Where is the nearest exit?', translation: 'Find an escape route' },
      { situation: 'You witness a crime', phrase: 'Someone just robbed that person! Call the police!', translation: 'Report a crime in progress' },
      { situation: 'You need first aid', phrase: 'Is there a first aid kit nearby?', translation: 'Locate medical supplies' },
      { situation: 'You are trapped', phrase: 'I am stuck and cannot move. Please help me.', translation: 'Request rescue assistance' },
    ],
  },
  {
    id: 'housing', title: 'Housing', icon: '\uD83C\uDFE0',
    description: 'Find an apartment, talk to landlord',
    phrases: [
      { situation: 'You want to see an apartment', phrase: 'I would like to schedule a viewing.', translation: 'Request to see the property' },
      { situation: 'You ask about rent', phrase: 'What is the monthly rent?', translation: 'Ask about the cost' },
      { situation: 'Something is broken', phrase: 'The heating is not working in my apartment.', translation: 'Report a maintenance issue' },
      { situation: 'You ask about the lease', phrase: 'How long is the lease agreement?', translation: 'Ask about contract terms' },
      { situation: 'You need to pay rent', phrase: 'I will pay the rent by bank transfer.', translation: 'Discuss payment method' },
      { situation: 'You want to move out', phrase: 'I would like to give my notice to move out.', translation: 'Begin the move-out process' },
      { situation: 'You have noisy neighbors', phrase: 'My neighbors are very loud at night.', translation: 'Complain about noise' },
      { situation: 'You need utilities set up', phrase: 'How do I set up electricity and internet?', translation: 'Ask about utility connections' },
    ],
  },
  {
    id: 'transport', title: 'Transportation', icon: '\uD83D\uDE8C',
    description: 'Buses, trains, and getting around',
    phrases: [
      { situation: 'You need a ticket', phrase: 'One ticket to the city center, please.', translation: 'Purchase transportation' },
      { situation: 'You are on the wrong bus', phrase: 'Does this bus go to the main station?', translation: 'Verify your route' },
      { situation: 'You need to know when it arrives', phrase: 'When does the next train arrive?', translation: 'Ask about the schedule' },
      { situation: 'You need directions', phrase: 'Which platform for the train to the airport?', translation: 'Find the right platform' },
      { situation: 'You want to get off', phrase: 'Excuse me, I need to get off at the next stop.', translation: 'Signal your stop' },
      { situation: 'You are running late', phrase: 'Is there a faster route?', translation: 'Ask about alternatives' },
      { situation: 'You need a taxi', phrase: 'Can you take me to this address?', translation: 'Give directions to taxi driver' },
      { situation: 'You lost something on transit', phrase: 'I left my bag on the bus. Where is the lost and found?', translation: 'Report lost item on transit' },
    ],
  },
]

type PracticeMode = 'practice' | 'quiz'
type Difficulty = 'beginner' | 'advanced'

// ---------------------------------------------------------------------------
// TTS helper
// ---------------------------------------------------------------------------

function speak(text: string, lang?: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  if (lang) u.lang = lang
  u.rate = 0.85
  speechSynthesis.speak(u)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScenarioMode() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [mode, setMode] = useState<PracticeMode>('practice')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null)
  const [quizOptions, setQuizOptions] = useState<string[]>([])
  const [completed, setCompleted] = useState(false)

  const currentPhrase = selectedScenario?.phrases[currentIndex]

  // Generate quiz options
  const generateQuizOptions = useCallback((scenario: Scenario, phraseIndex: number) => {
    const correct = scenario.phrases[phraseIndex].phrase
    const others = scenario.phrases
      .filter((_, i) => i !== phraseIndex)
      .map(p => p.phrase)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    const options = [...others, correct].sort(() => Math.random() - 0.5)
    setQuizOptions(options)
  }, [])

  const startScenario = useCallback((scenario: Scenario) => {
    setSelectedScenario(scenario)
    setCurrentIndex(0)
    setRevealed(false)
    setScore(0)
    setQuizAnswer(null)
    setCompleted(false)
    if (mode === 'quiz') {
      generateQuizOptions(scenario, 0)
    }
  }, [mode, generateQuizOptions])

  const nextPhrase = useCallback(() => {
    if (!selectedScenario) return
    if (currentIndex + 1 >= selectedScenario.phrases.length) {
      setCompleted(true)
      return
    }
    const nextIdx = currentIndex + 1
    setCurrentIndex(nextIdx)
    setRevealed(false)
    setQuizAnswer(null)
    if (mode === 'quiz') {
      generateQuizOptions(selectedScenario, nextIdx)
    }
  }, [selectedScenario, currentIndex, mode, generateQuizOptions])

  const handleQuizAnswer = useCallback((optionIndex: number) => {
    if (!currentPhrase || quizAnswer !== null) return
    setQuizAnswer(optionIndex)
    if (quizOptions[optionIndex] === currentPhrase.phrase) {
      setScore(s => s + 1)
    }
  }, [currentPhrase, quizAnswer, quizOptions])

  const goBack = useCallback(() => {
    setSelectedScenario(null)
    setCompleted(false)
  }, [])

  // --- Scenario Selection ---
  if (!selectedScenario) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <span className="text-2xl">\uD83C\uDFAF</span> Scenario Survival Mode
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Master essential phrases for real-world situations
            </p>
          </div>
        </div>

        {/* Mode & Difficulty Selection */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex gap-2">
            {(['practice', 'quiz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                  mode === m
                    ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
                }`}
              >
                {m === 'practice' ? '\uD83D\uDCDD Practice' : '\u2753 Quiz'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['beginner', 'advanced'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                  difficulty === d
                    ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
                }`}
              >
                {d === 'beginner' ? 'Beginner' : 'Advanced'}
              </button>
            ))}
          </div>
        </div>

        {/* Scenario Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {SCENARIOS.map(scenario => (
            <motion.button
              key={scenario.id}
              onClick={() => startScenario(scenario)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer text-left hover:border-[var(--color-primary-main)] transition-colors"
            >
              <div className="text-3xl mb-2">{scenario.icon}</div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{scenario.title}</h3>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 line-clamp-2">{scenario.description}</p>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-2">{scenario.phrases.length} phrases</div>
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  // --- Completed ---
  if (completed) {
    const total = selectedScenario.phrases.length
    const pct = mode === 'quiz' ? Math.round((score / total) * 100) : 100

    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <div className="text-5xl mb-3">{pct >= 80 ? '\uD83C\uDF1F' : pct >= 50 ? '\uD83D\uDC4D' : '\uD83D\uDCAA'}</div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            {selectedScenario.icon} {selectedScenario.title} Complete!
          </h3>
          {mode === 'quiz' && (
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-primary-main)' }}>
              {score} / {total} ({pct}%)
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={goBack}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
          >
            All Scenarios
          </button>
          <button
            onClick={() => startScenario(selectedScenario)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer bg-[var(--color-primary-main)] text-white hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // --- Practice / Quiz Mode ---
  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goBack}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
        >
          &larr; Back
        </button>
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {selectedScenario.icon} {selectedScenario.title}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {currentIndex + 1} / {selectedScenario.phrases.length}
        </span>
      </div>

      {/* Progress */}
      <div className="h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden mb-5">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${((currentIndex + 1) / selectedScenario.phrases.length) * 100}%`,
            background: 'var(--color-primary-main)',
          }}
        />
      </div>

      {currentPhrase && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            {/* Situation prompt */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-4">
              <div className="text-xs font-semibold text-[var(--color-primary-main)] mb-2 uppercase tracking-wider">
                Situation
              </div>
              <p className="text-base text-[var(--color-text-primary)] font-medium">
                {currentPhrase.situation}
              </p>
            </div>

            {mode === 'practice' ? (
              <>
                {/* Practice: show phrase on reveal */}
                {difficulty === 'beginner' && !revealed && (
                  <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-5 mb-4 text-center">
                    <p className="text-sm text-[var(--color-text-muted)] italic">
                      Think of how you would respond...
                    </p>
                  </div>
                )}

                {(revealed || difficulty === 'beginner') && (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-lg font-bold text-[var(--color-text-primary)]">
                          {currentPhrase.phrase}
                        </p>
                        {difficulty === 'beginner' && (
                          <p className="text-sm text-[var(--color-text-muted)] mt-2">
                            {currentPhrase.translation}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => speak(currentPhrase.phrase)}
                        className="p-2 rounded-full cursor-pointer border-none bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-primary-main)] transition-colors ml-3 shrink-0"
                        aria-label="Listen"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {!revealed && difficulty === 'advanced' && (
                    <button
                      onClick={() => setRevealed(true)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer bg-[var(--color-primary-main)] text-white hover:opacity-90"
                    >
                      Reveal Answer
                    </button>
                  )}
                  {(revealed || difficulty === 'beginner') && (
                    <button
                      onClick={nextPhrase}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer bg-[var(--color-primary-main)] text-white hover:opacity-90"
                    >
                      {currentIndex + 1 >= selectedScenario.phrases.length ? 'Finish' : 'Next'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* Quiz mode */
              <div className="space-y-2 mb-4">
                {quizOptions.map((opt, i) => {
                  const isCorrect = opt === currentPhrase.phrase
                  const isSelected = quizAnswer === i
                  const showResult = quizAnswer !== null

                  return (
                    <button
                      key={i}
                      onClick={() => handleQuizAnswer(i)}
                      disabled={quizAnswer !== null}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all border ${
                        showResult && isCorrect
                          ? 'border-green-500 bg-green-500/10 text-green-600'
                          : showResult && isSelected && !isCorrect
                            ? 'border-red-500 bg-red-500/10 text-red-600'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-primary-main)]'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
                {quizAnswer !== null && (
                  <button
                    onClick={nextPhrase}
                    className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer bg-[var(--color-primary-main)] text-white hover:opacity-90 mt-3"
                  >
                    {currentIndex + 1 >= selectedScenario.phrases.length ? 'See Results' : 'Next'}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {mode === 'quiz' && (
        <div className="text-center text-xs text-[var(--color-text-muted)] mt-4">
          Score: {score} / {currentIndex + (quizAnswer !== null ? 1 : 0)}
        </div>
      )}
    </div>
  )
}
