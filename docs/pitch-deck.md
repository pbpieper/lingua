# Lingua: Language Learning, Reimagined

**AI-powered. Privacy-first. Runs on your device.**

*Seed Round | March 2026*

---

## The Problem

### A $60B Market With No Clear Winner for Serious Learners

The global language learning market is projected to reach **$60 billion by 2028**, growing at **20% CAGR** (HolonIQ, Grand View Research). Yet no existing platform adequately serves learners who want to move beyond tourist phrases and actually achieve fluency.

**Duolingo** (200M+ MAU) gamifies vocabulary drills but teaches words in isolation. After years of daily use, learners still cannot hold a basic conversation. Duolingo's own efficacy study showed only **marginal gains** in speaking ability. Its retention rate beyond 2 weeks is under 10%.

**LingQ** pioneered reading-based learning but suffers from dated UX, unreliable SRS, and a fragmented feature set that frustrates users. Its 150K user base has platelined.

**Anki** offers the gold standard in spaced repetition but presents a hostile interface, requires manual card creation, and offers zero content or guidance. It is a tool, not a learning platform.

**No platform today combines:**
- Real content (stories, articles, conversations)
- State-of-the-art spaced repetition
- AI-powered content generation and feedback
- Teacher tools for classroom deployment
- Full data privacy

**Meanwhile, critical use cases go underserved:**
- **Schools** lack digital tools for vocabulary tracking and differentiated instruction across proficiency levels.
- **Military and immigration programs** rely on outdated methods with no adaptive technology.
- **Corporate L&D** budgets are growing 15% YoY, but off-the-shelf solutions don't integrate with internal workflows.

---

## The Solution

### A Complete Language Learning Operating System, Powered by Local AI

Lingua is a **reading-first, AI-powered language learning platform** with 21 integrated tools spanning every language skill. It is built on two foundational principles backed by decades of research:

**1. Comprehensible Input (Krashen, 1982)**
Languages are acquired through exposure to meaningful content at the learner's level --- not through grammar drills. Lingua generates personalized graded stories using AI, calibrated to each learner's known vocabulary.

**2. Optimized Spaced Repetition (FSRS-4.5)**
Lingua implements the Free Spaced Repetition Scheduler 4.5, the most advanced open-source SRS algorithm available. Published benchmarks show FSRS-4.5 achieves the **same retention with 30% fewer reviews** compared to SM-2 (used by Anki) and SuperMemo's SM-18.

**3. Local AI --- Zero Cloud Costs, Full Privacy**
All AI features run locally via Ollama (open-source LLMs). Story generation, grammar lessons, sentence mining, pronunciation feedback --- none of it touches external servers. This eliminates per-request API costs that plague competitors and guarantees GDPR/FERPA compliance by default.

### The 21-Tool Platform

| Category | Tools |
|---|---|
| **Core Learning** | FSRS-4.5 Flashcards, Tag-Filtered Sessions, Smart Daily Study Plan |
| **Reading** | AI Graded Stories, Reading Assist (paste-and-highlight), Pre-Learn Pipeline |
| **Active Practice** | Sentence Cloze, Fill-in-the-Blank, Multiple Choice Quiz, Match Game |
| **Production** | Speaking Practice (with AI feedback), Listening Practice, Writing Practice |
| **Grammar** | AI Grammar Lessons with Interactive Exercises |
| **Visualization** | Vocabulary Galaxy (SVG universe of known words) |
| **Engagement** | 19 Achievements, XP/Level System, Streak Tracking, Leaderboard |
| **Community** | Shared Vocabulary Lists, Friends, Community Leaderboard |
| **Classroom** | Teacher Portal, Class Management, Assignments, Join Codes, Progress Tracking |
| **Browser** | Chrome Copilot Extension (double-click lookup, highlight mode) |

---

## Product Deep Dive

### How It Works

```
1. UPLOAD or PASTE text in your target language
2. Lingua HIGHLIGHTS unknown words instantly
3. TAP to look up, ADD to your personal vocabulary
4. REVIEW with FSRS-4.5 --- the algorithm optimizes your review schedule
5. READ AI-generated stories built from YOUR vocabulary
6. PRACTICE speaking, listening, and writing with AI feedback
7. TRACK progress in the Vocabulary Galaxy and daily dashboard
```

### Key Differentiators

**Pre-Learn Pipeline** --- Paste any text (article, book chapter, subtitles). Lingua identifies every word you don't know, creates a targeted study set, and lets you pre-learn vocabulary before reading. No other platform offers this workflow.

**AI Graded Stories** --- Ollama generates stories using 90% known vocabulary + 10% new words (the optimal i+1 ratio from SLA research). Stories are personalized to the learner's interests and current level.

**Vocabulary Galaxy** --- A living SVG visualization where every learned word becomes a star. Word clusters form constellations by topic. Mastered words glow brighter. This transforms the abstract feeling of "am I making progress?" into something tangible and beautiful.

**Chrome Copilot** --- Double-click any word on any webpage to look it up and add it to your vocabulary. Highlight mode shows known/unknown words across the entire page. The web becomes your textbook.

**Teacher Portal** --- Teachers create classes with join codes, assign vocabulary lists, set deadlines, and track individual student progress. Built for the reality of K-12 and university language instruction.

### Technical Architecture

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Tailwind v4 | Modern, performant, mobile-responsive |
| Build | Vite with code-splitting | 229KB main bundle, lazy-loaded tools |
| Backend | FastAPI + SQLite | Lightweight, deployable anywhere |
| AI | Ollama (local LLMs, e.g., llama3.2:3b) | Zero API costs, full privacy |
| SRS | FSRS-4.5 | State-of-the-art, open-source |
| i18n | RTL support, CEFR tagging | Global-ready from day one |

---

## Market Opportunity

### Total Addressable Market

```
TAM   $60B    Global language learning (apps, tutors, schools, corporate)
 |
SAM   $15B    Digital language learning (apps, platforms, edtech SaaS)
 |
SOM   $500M   Self-directed intermediate learners + K-12 language teachers
```

### Target Segments

| Segment | Size | Pain Point | Lingua's Value |
|---|---|---|---|
| **Self-directed learners** (B2C) | 500M+ globally | Plateau after beginner phase; tools don't scale | Reading-first + FSRS + AI stories bridge the intermediate gap |
| **K-12 & University** (B2B) | 1.5M language teachers in US alone | No good digital vocab tracking; can't differentiate | Teacher portal, class management, progress analytics |
| **Corporate L&D** (B2B) | $3.5B market, 15% CAGR | Generic platforms, poor ROI measurement | Custom deployments, progress tracking, on-prem option |
| **Government & Military** (B2B) | $1.2B US defense language budget | Outdated DLIFLC methods, classified environments | Air-gapped local AI, no cloud dependency |

### Why Now

1. **Local LLMs crossed the quality threshold.** Llama 3.2 at 3B parameters runs on consumer hardware and generates coherent, pedagogically useful content. This was impossible 18 months ago.
2. **FSRS-4.5 was published in 2023** and is already adopted by Anki's plugin ecosystem. It is the clear successor to SM-2.
3. **Duolingo's limitations are entering public discourse.** Articles in The Atlantic, Wired, and major language learning communities increasingly question gamification-only approaches.
4. **Privacy regulation is accelerating.** GDPR, FERPA, state-level student data laws --- a local-first architecture is a structural advantage, not a feature.

---

## Competitive Landscape

### Positioning Matrix

```
                    HIGH CONTENT QUALITY
                          |
           Lingua         |         LingQ
         (AI-generated,   |       (real content,
          personalized)    |        poor UX)
                          |
  ────────────────────────┼──────────────────────
                          |
           Duolingo       |         Anki
         (gamified but    |       (powerful SRS,
          shallow)        |        no content)
                          |
                    LOW CONTENT QUALITY

  LOW SRS QUALITY ────────────────── HIGH SRS QUALITY
```

### Feature Comparison

| Feature | Lingua | Duolingo | LingQ | Anki | Memrise | Busuu |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| State-of-the-art SRS (FSRS) | Yes | No | No | Plugin | No | No |
| AI content generation | Yes (local) | No | No | No | No | No |
| Reading-first approach | Yes | No | Yes | No | No | Partial |
| Teacher portal | Yes | Partial | No | No | No | No |
| Chrome extension | Yes | No | Yes | No | No | No |
| Speaking practice w/ AI | Yes | Limited | No | No | No | Yes |
| Data privacy (local AI) | Yes | No | No | N/A | No | No |
| Vocabulary visualization | Yes | No | No | No | No | No |
| Free tier | Yes | Yes (ads) | Trial | Yes | Yes (ads) | Trial |
| Open-source core | Yes | No | No | Yes | No | No |

### Competitive Moat

1. **Local AI architecture** --- Competitors would need to fundamentally re-architect to match. Cloud-dependent platforms face per-request costs that scale linearly with users.
2. **FSRS-4.5 integration** --- Deep algorithmic integration, not a bolt-on. Review efficiency is measurably superior.
3. **21-tool ecosystem** --- Network effects within the product: vocabulary learned via flashcards appears in generated stories, Reading Assist, cloze exercises, and the Galaxy. Each tool reinforces the others.
4. **Open-source core** --- Community contributions, trust, and adoption velocity that proprietary competitors cannot match.

---

## Business Model

### Revenue Streams

#### B2C: Freemium Subscription

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | 5 tools, 100 vocabulary words, basic SRS |
| **Pro** | $9.99/mo ($79.99/yr) | All 21 tools, unlimited vocabulary, AI stories, Chrome extension, Galaxy |
| **Family** | $14.99/mo | Pro for up to 5 family members |

**Conversion target:** 5% free-to-paid (industry average for education apps is 2-4%).

#### B2B: Education

| Package | Price | Includes |
|---|---|---|
| **School License** | $3/student/year | Teacher portal, class management, progress analytics, admin dashboard |
| **District License** | $2/student/year (volume) | Multi-school deployment, district-level reporting, SSO integration |

**K-12 market entry:** US alone has 10.6M students enrolled in world language courses.

#### B2B: Enterprise & Government

| Package | Price | Includes |
|---|---|---|
| **Corporate** | $15/seat/month | Custom vocabulary lists, progress tracking, LMS integration, dedicated support |
| **Government/Military** | Custom (est. $50-200K/contract) | Air-gapped deployment, on-premise AI, classified environment compatibility, custom content |

### Revenue Projections

| Year | Users (Free) | Users (Paid) | B2B Contracts | ARR |
|---|---:|---:|---:|---:|
| **Year 1** | 1,000 | 0 | 0 | $0 (building) |
| **Year 2** | 10,000 | 500 | 3 schools | $200K |
| **Year 3** | 50,000 | 3,000 | 15 schools, 2 corporate | $2M |
| **Year 4** | 150,000 | 10,000 | 50 schools, 5 corporate, 1 gov | $7M |
| **Year 5** | 400,000 | 25,000 | 150 schools, 15 corporate, 3 gov | $15M |

### Unit Economics (at scale, Year 3+)

- **CAC (B2C):** $15 (organic/community-driven, low paid acquisition)
- **LTV (Pro subscriber):** $180 (avg 18-month retention at $9.99/mo)
- **LTV:CAC ratio:** 12:1
- **Gross margin:** 85%+ (no cloud AI costs; primary costs are engineering and support)
- **Infrastructure cost per user:** ~$0.10/mo (static hosting + lightweight API; AI runs on user's device)

---

## Go-to-Market Strategy

### Phase 1: Community & Open Source (Months 1-6)

- Release open-source core on GitHub
- Target polyglot communities (Reddit r/languagelearning, Refold, language Discord servers)
- Content marketing: blog posts on FSRS vs. SM-2, reading-based learning, local AI for education
- Goal: **1,000 active users**, community contributions, product validation

### Phase 2: Pro Launch (Months 6-12)

- Launch Pro subscription with all 21 tools
- Target intermediate learners who have plateaued with Duolingo (the "post-Duolingo" segment)
- Influencer partnerships with language learning YouTubers (Steve Kaufmann, Luca Lampariello)
- Goal: **10,000 users, 500 paid**

### Phase 3: Education Pilot (Months 12-18)

- Pilot with 10 schools across 3 districts
- Build case studies with measurable outcomes (vocabulary retention, test scores)
- Attend ACTFL (American Council on the Teaching of Foreign Languages) annual convention
- Goal: **15 school contracts, $500K B2B pipeline**

### Phase 4: Scale (Months 18-30)

- Corporate training partnerships
- Government/military RFP responses (leveraging air-gapped, local AI as key differentiator)
- International expansion (EU, Asia)
- Goal: **$2M ARR, clear path to $15M by Year 5**

### Distribution Channels

| Channel | Cost | Expected Impact |
|---|---|---|
| Open-source / GitHub | Free | Developer adoption, trust, contributions |
| Reddit / Discord communities | Free | Early adopter acquisition |
| SEO / Content marketing | Low | Long-term organic traffic |
| YouTube influencers | Medium | Awareness among target demographic |
| ACTFL / EdTech conferences | Medium | B2B education pipeline |
| Chrome Web Store | Free | Copilot extension as acquisition funnel |
| App Store / Google Play | Low | Mobile version as growth driver |

---

## Traction

### What We Have Built (as of March 2026)

**21 production-ready tools** --- not mockups, not prototypes. Every tool listed in this deck is implemented, tested, and functional.

| Milestone | Status |
|---|---|
| FSRS-4.5 spaced repetition engine | Shipped |
| AI graded story generation (Ollama) | Shipped |
| AI grammar lessons with exercises | Shipped |
| Sentence cloze with AI-generated contexts | Shipped |
| Vocabulary Galaxy (SVG visualization) | Shipped |
| Teacher portal (classes, assignments, join codes) | Shipped |
| Community features (leaderboard, shared lists, friends) | Shipped |
| Chrome Copilot extension | Shipped |
| Smart Daily Study Plan | Shipped |
| Reading Assist + Pre-Learn Pipeline | Shipped |
| Speaking, Listening, Writing practice | Shipped |
| Match Game, Fill-in-the-Blank, Quiz | Shipped |
| 19 achievements, XP/levels, streaks | Shipped |
| Tag-filtered sessions | Shipped |
| RTL support, CEFR tagging | Shipped |
| Code-split lazy loading (229KB main bundle) | Shipped |
| Mobile-responsive design | Shipped |

### Technical Validation

- **229KB main bundle** with full code splitting --- competitive with Duolingo's mobile web at 2MB+
- **FSRS-4.5** passes all reference test vectors; review scheduling matches published benchmarks
- **Local AI latency:** ~2-4 seconds for story generation on consumer hardware (M1+ Mac, RTX 3060+ PC)
- **Zero runtime cloud costs** --- the entire platform runs on a single $5/mo VPS for the API, with AI on the user's device

---

## Team Needs

### Key Hires (Seed Stage)

| Role | Priority | Why |
|---|---|---|
| **CTO** | Critical | Scale architecture from prototype to production; lead engineering team |
| **Head of Product** | Critical | User research, roadmap prioritization, metrics-driven iteration |
| **Head of Sales (Education)** | High | K-12 and university relationships; navigate procurement cycles |
| **ML Engineer** | High | Fine-tune local models for language education; optimize inference |
| **Full-Stack Engineers (2)** | High | Ship features, scale infrastructure, mobile apps |
| **UX Designer** | Medium | User testing, design system, accessibility |
| **Content Linguist** | Medium | Curriculum design, language-specific content, pedagogical validation |

### Advisory Board (Target)

- SLA researcher (Second Language Acquisition) for pedagogical credibility
- Former edtech executive for go-to-market guidance
- Open-source community leader for ecosystem growth

---

## The Ask

### Seed Round: $2,000,000

| Category | Allocation | Amount | Purpose |
|---|---|---|---|
| **Engineering** | 50% | $1,000,000 | CTO, 2 full-stack engineers, ML engineer, infrastructure |
| **Sales & Marketing** | 25% | $500,000 | Head of Sales (Education), content marketing, conference presence, influencer partnerships |
| **Content & Research** | 15% | $300,000 | Content linguist, curriculum development, efficacy studies |
| **Operations** | 10% | $200,000 | Legal, accounting, office, tools |

### Milestones (18-Month Runway)

| Month | Milestone |
|---|---|
| 3 | CTO and Head of Product hired; mobile app in development |
| 6 | 5,000 users; Pro tier launched; 3 language YouTuber partnerships |
| 9 | 10,000 users; 500 paid subscribers; first school pilot signed |
| 12 | Mobile app launched; 10 school contracts; $200K ARR |
| 15 | Corporate training pilot; ACTFL conference presentation; efficacy study published |
| 18 | 25,000 users; $500K ARR; Series A pipeline open |

### Return Profile

- **Target Series A:** $8-12M at 18 months, based on $500K+ ARR and proven B2B traction
- **Exit comparables:**
  - Duolingo IPO (2021): $6.5B valuation at ~$250M revenue
  - Busuu acquired by Chegg (2021): $436M
  - Babbel valued at $1B+ pre-IPO
- **Path to profitability:** 85%+ gross margins; break-even at ~$3M ARR (Year 3-4)

---

## Vision

> *"Every person on Earth should be able to learn any language, privately and effectively, using AI that runs on their own device."*

### The Long-Term Future

**Year 1-2:** Best-in-class vocabulary and reading platform with local AI. Prove the model with self-directed learners and early school adopters.

**Year 3-4:** Multilingual AI tutor that adapts to each learner's brain. The system knows your strengths, weaknesses, interests, and optimal study patterns. It generates a unique learning path for every user.

**Year 5+:** The language learning operating system. Every school, every corporate training program, every motivated learner has access to AI-powered, privacy-respecting language education --- regardless of their country, income level, or internet connectivity.

The tools to learn any language should not be locked behind subscription paywalls to cloud AI services, gated by geography, or compromised by data harvesting. Lingua is building the alternative: **open, private, intelligent, and effective.**

---

*Lingua --- Language Learning, Reimagined.*

*Contact: [founder email] | [website] | [GitHub]*
