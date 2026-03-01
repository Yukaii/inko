# 🧠 Inkō — Product Requirements Document (PRD)

---

## 1. Product Overview

### 1.1 Product Name
**Inkō**

**Tagline:** *Write it. Hear it. Type it. Remember it.*

### 1.2 Vision

Inkō is a multi-sensory vocabulary learning tool designed to strengthen memory through **simultaneous handwriting, audio reinforcement, and IME typing practice**.

It recreates the cognitive depth of writing in a notebook while enhancing it with digital feedback, sound, and structured repetition.

### 1.3 Core Thesis

Memory strengthens when multiple neural pathways are activated at once. Inkō activates:

* Visual recognition (seeing the word)
* Motor memory (handwriting)
* Phonological memory (hearing pronunciation)
* Procedural memory (IME typing)

Instead of passive recognition, Inkō trains **production across all channels simultaneously**.

---

## 2. Problem Statement

Current vocabulary tools focus heavily on recognition (flashcards, multiple choice).

Common gaps:

* Writing practice is separated from vocabulary review
* IME typing skills are not trained alongside vocabulary
* Audio is passive, not integrated into active recall
* Learners struggle to connect reading, writing, typing, and pronunciation

Inkō bridges these gaps by combining all input methods into a unified learning flow.

---

## 3. Target Users

### 3.1 Primary Users

* Learners of Chinese, Japanese, Korean
* Learners of languages with non-Latin scripts (Arabic, Thai, Hindi, etc.)
* Exam candidates (HSK, JLPT, TOPIK)
* Intermediate learners transitioning from recognition to production

### 3.2 Secondary Users

* Polyglots expanding vocabulary depth
* Students in formal language programs
* Self-directed learners seeking stronger retention

---

## 4. Product Principles

1. **Simultaneity over Sequence**
   Writing, typing, and listening occur in the same learning session.

2. **Production over Recognition**
   Users must generate the word, not just recognize it.

3. **Muscle Memory Matters**
   Handwriting reinforces character shape retention.

4. **Weakest Channel First**
   Spaced repetition prioritizes the weakest skill area.

5. **Minimal Friction**
   No complex setup required to start learning.

---

## 5. Core Features (Current Scope)

### 5.1 Word Bank Management

Users can:

* Create decks
* Add words manually
* Use pre-built starter decks
* Tag and organize words

Each word includes:

* Target word
* Romanization
* Meaning
* Audio
* Example sentence
* Optional stroke data

---

### 5.2 Triple-Input Practice Mode (Core Experience)

Each vocabulary card requires three forms of interaction:

#### A. Handwriting (Trace)

* Freehand writing area
* Ghost guide (optional)
* Stroke-by-stroke hint mode
* Clear and undo options
* Accuracy scoring

Purpose: Build motor memory and visual structure recognition.

---

#### B. IME Typing

* Input field for romanized typing
* Candidate selection simulation (for CJK languages)
* Validation against correct target word
* Typing speed tracking
* Accent/diacritic sensitivity options

Purpose: Train real-world typing proficiency.

---

#### C. Audio Reinforcement

* Auto-play on reveal
* Replay option
* Slow-speed playback
* Optional waveform visualization

Purpose: Reinforce pronunciation and listening memory.

---

### 5.3 Simultaneous Interaction Model

All three components are visible on one screen.

To complete a card:

* Handwriting must be accepted
* IME typing must be correct
* Audio must be played at least once (passive listening allowed)

Completion generates:

* Shape score
* Typing score
* Listening confidence score (user-rated)

---

### 5.4 Spaced Repetition Engine

Each word tracks separate performance metrics:

* Shape accuracy
* Typing accuracy and speed
* Listening confidence

Review scheduling is based on the weakest metric.

Example:
* If handwriting is strong but typing is weak → card appears in typing-focused mode more often.

---

### 5.5 Review Modes

Users can choose learning modes:

* Full Triple Mode (default)
* Handwriting Only
* Typing Only
* Listen & Write (dictation mode)
* Speed Typing Mode
* Exam Simulation Mode

---

### 5.6 Progress Dashboard

Dashboard includes:

* Total words learned
* Words due today
* Learning streak
* Channel strength comparison
* Weekly/monthly activity heatmap
* Weakest skill insights

Users can view:

* Per-deck progress
* Per-language progress
* Time spent per channel

---

## 6. User Flow

### 6.1 First-Time User

1. Choose language
2. Select starter deck or import own
3. Complete onboarding tutorial
4. Begin first Triple-Input session

---

### 6.2 Daily Use Flow

1. Open app
2. See number of reviews due
3. Enter practice session
4. Complete triple-input cards
5. View session summary
6. Continue or exit

---

## 7. Gamification Layer

Optional features to increase retention:

* Daily streak tracking
* Skill badges (Shape Master, Typing Sprinter, Listening Ace)
* XP and leveling
* Weekly consistency reward
* Skill radar growth visualization

Gamification must not distract from core learning.

---

## 8. Accessibility & Usability

* Dark mode
* Adjustable font size
* Left-handed writing mode
* Audio playback speed control
* Stylus support
* Offline practice support

---

## 9. Metrics for Success

### 9.1 User Metrics

* Daily Active Users (DAU)
* 7-day retention
* 30-day retention
* Average session duration
* Words mastered per week

### 9.2 Learning Metrics

* Improvement in typing speed over time
* Reduction in handwriting error rate
* Increased retention interval growth
* Decrease in weakest-channel variance

---

## 10. Non-Goals (Current Scope)

Inkō will not initially include:

* CSV import
* Social networking features
* Live tutoring
* Marketplace for teachers
* Complex grammar lessons
* Full language course structure

The focus remains on **vocabulary production mastery**.

---

## 11. Future Expansion

* Sentence construction mode
* Radical/component breakdown view
* AI-generated mnemonic stories
* OCR word import from photos
* Multiplayer typing challenges
* Cross-device handwriting sync
* Teacher classroom dashboard

---

# Summary

Inkō is a production-focused vocabulary learning tool that integrates:

* Handwriting
* IME typing
* Audio reinforcement

All in one simultaneous learning experience.

It is designed to turn passive learners into active producers of language — strengthening memory through shape, sound, and input mastery.

---

## 12. Implementation Status (as of March 1, 2026)

### 12.1 Delivered

* Web app monorepo scaffold:
  * `apps/web` (Vite + React + TypeScript)
  * `apps/api` (Fastify + TypeScript)
  * `packages/shared` (zod schemas + scoring/scheduling logic)
  * `convex/` (schema + domain functions)
* Auth:
  * Email magic-link request/verify endpoints
  * JWT-based API auth for protected routes
  * Resend-backed email delivery for magic links in dev/prod flows
* Word Bank:
  * Create/list/update decks
  * Create/list/update/delete words
  * Per-user ownership checks on deck and word operations
* Triple-Input Practice:
  * Session start/submit/finish endpoints
  * Handwriting canvas (self-check completion model)
  * Typing validation (normalized JP input; target or reading)
  * Audio gate (must be played/marked played)
  * Score generation (shape/typing/listening)
  * Session safety UX: accidental exit protection via double-`Esc` intent + explicit confirm exit
  * Large-deck consumption strategy: fixed per-session quota (default 50 cards) with auto carry-over across sessions
  * Session progress metadata (`cardsCompleted`, `remainingCards`, `sessionTargetCards`) and capped completion handling
* Scheduling:
  * Per-word channel stats (shape/typing/listening)
  * Weakest-channel-first and due-date updates after attempts
* Dashboard:
  * Summary endpoint and frontend cards for core KPIs
  * Recent session list support
  * Bounded summary computation for large datasets to avoid Convex read/paginate limits
* Starter seed:
  * Convex mutation for `Core N5` deck + starter JP vocabulary
  * Bun script for quick seeding
* Performance and scalability hardening:
  * Batch word create/delete now chunked to respect Convex argument and execution limits
  * Deck deletion made incremental/paged to avoid large read explosions
  * Practice submit latency reduced via session-level attempted-word tracking and candidate-window cache
  * Practice candidate scans reduced and bounded for faster start/submit under large decks
  * Practice cold-start performance improved to an acceptable baseline after queue/preselection optimization work
* Quality gates:
  * Shared/unit tests
  * API integration tests (Fastify `inject`)
  * Web component tests for practice submit gating
  * API performance guard tests for large batch chunking

### 12.2 Partially Delivered

* UI parity with Pencil design:
  * Core layout and tokens are implemented
  * Fine-grained visual parity and polish are still pending
* Audio experience:
  * Built-in TTS support is available during practice
  * Works with stored `audioUrl` or generated pronunciation playback
  * No advanced playback UX (slow mode, waveform) yet

### 12.3 Not Yet Delivered

* CSV import workflow
* Additional review modes beyond full Triple Mode
* Advanced analytics visuals (heatmap/radar)
* Deployment hardening and production infrastructure

---

## 13. Current Product Focus (Immediate Next Steps)

1. Improve visual fidelity against `inko.pen` for dashboard and practice screens.
2. Expand API integration coverage for all authorization edge cases and large-deck regression paths.
3. Add operational docs for cloud deployment + environment matrix.
4. Ship CSV import workflow.
5. Validate practice performance with regression benchmarks/tracing so recent speed gains stay intact.

Implementation reference:

- See `docs/practice-queue-design.md` for the queue-backed practice selection redesign used to address large-deck latency.
