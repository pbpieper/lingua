# Tool Variables & Variations Matrix

Each tool supports **variables** (adjustable settings) and **variations** (different play modes). Users toggle these via the `ToolOptionsBar` component — no page reloads, settings persist in localStorage.

## Framework

- **Types:** `src/types/toolConfig.ts` — `ToolVariable`, `ToolVariation`, `ToolConfig`
- **UI Component:** `src/components/atoms/ToolOptionsBar.tsx`
- **Persistence:** `loadToolConfig()` / `saveToolConfig()` with localStorage

---

## Implemented

### Match Game
| Type | Key | Options |
|------|-----|---------|
| Variation | `memory` | Flip cards to find matching pairs (default) |
| Variation | `column` | Two columns — connect word to translation |
| Variable | `pairCount` | 4 / 6 / 8 pairs |
| Variable | `direction` | Word→Translation or Translation→Word |
| Variable | `timer` | On/off |

**Future variations:** Image matching, synonym/antonym matching

### Fill in the Blank
| Type | Key | Options |
|------|-----|---------|
| Variation | `sentence` | Type the missing word (default) |
| Variation | `wordbank` | Pick from a word bank |
| Variable | `itemCount` | 5 / 10 / 15 / 20 items |
| Variable | `showHint` | Show/hide translation hints |

**Future variations:** Story paragraph with multiple blanks, read-then-blank

---

## Planned (not yet implemented)

### Quiz (Multiple Choice)
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `standard` | Pick correct translation |
| Variation | `typing` | Type the answer instead of picking |
| Variation | `audio` | Hear word, pick translation |
| Variable | `direction` | L2→L1 / L1→L2 |
| Variable | `choiceCount` | 3 / 4 / 5 options |
| Variable | `timer` | On/off + duration |

### Flashcards
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `flip` | Classic A/B flip |
| Variation | `type` | Type to reveal |
| Variation | `speak` | Speak to flip (requires TTS backend) |
| Variable | `direction` | Word→Translation / Translation→Word |
| Variable | `showImage` | Show associated image if available |
| Variable | `autoPlay` | Auto-advance after X seconds |

### Speaking / Pronunciation
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `pronunciation` | Repeat after model |
| Variation | `conversation` | Free conversation with AI |
| Variable | `speed` | Slow / Normal / Fast playback |
| Variable | `showTranscript` | On/off |

### Reading / Stories
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `assisted` | Tap unknown words for definitions |
| Variation | `cloze` | Story with blanks to fill |
| Variable | `newWordPct` | % of unknown words (10/25/50) |
| Variable | `length` | Short / Medium / Long |
| Variable | `difficulty` | Based on CEFR level |

### Listening
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `dictation` | Hear and type what you hear |
| Variation | `comprehension` | Hear passage, answer questions |
| Variable | `speed` | Slow / Normal / Fast |
| Variable | `repeats` | 1 / 2 / 3 replays allowed |

### Writing
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `freewrite` | Write on a topic, AI corrects |
| Variation | `translate` | Translate a given sentence |
| Variable | `length` | Sentence / Paragraph / Essay |
| Variable | `correction` | Inline / Summary |

### Grammar
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `lesson` | Explanation + examples |
| Variation | `exercise` | Fill in correct form |
| Variable | `topic` | Select grammar topic |
| Variable | `difficulty` | Beginner / Intermediate / Advanced |

### Sentence Cloze
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `single` | One sentence at a time |
| Variation | `paragraph` | Multiple blanks in a paragraph |
| Variable | `bankVisible` | Show word bank or free type |
| Variable | `blankCount` | 1–5 blanks per sentence |

### Phrases / Dialogue
| Type | Key | Planned Options |
|------|-----|-----------------|
| Variation | `scenario` | Situational phrases (airport, restaurant) |
| Variation | `dialogue` | Interactive role-play |
| Variable | `topic` | Select scenario |
| Variable | `formality` | Casual / Formal |

---

## Adding Variables to a New Tool

1. Define `VARIATIONS` and `VARIABLES` arrays using the types from `@/types/toolConfig`
2. Use `loadToolConfig()` / `saveToolConfig()` for persistence
3. Add `<ToolOptionsBar>` at the top of the tool's render
4. Branch logic based on `variation` and read from `vars`

See `MatchGame.tsx` and `FillBlank.tsx` for reference implementations.
