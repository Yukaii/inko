# Practice Queue Design

## Summary

This document describes the queue-backed practice selection system used to replace live large-deck candidate scans at session start.

The goal is to make `/api/practice/session/start` read a pre-ranked next card from a materialized queue and warm the rest of the session buffer separately, instead of building a 50-card candidate window from `deck_words` on demand.

## Problem

Production tracing showed repeated session starts spending roughly 4 seconds end-to-end, with almost all of the latency inside the candidate fetch phase.

Representative trace:

- `session_start totalMs`: about `4136`
- `candidateFetchMs`: about `3893`

Convex traces showed the hot path query reading only a small amount of data, which pointed to query/storage latency rather than API CPU saturation or deck size alone.

## Root Cause

The previous design relied on a live candidate-building query over deck-linked words for every session start:

- read a bounded candidate window
- join or hydrate practice state
- rank the window
- return the first card

Even after denormalizing some state, the request still depended on an expensive live query path. Large deck size made this visible more often, but the root issue was the synchronous query shape, not that an 8k-card deck is intrinsically too large.

## Target Architecture

Use a synchronous materialized queue:

- canonical per-channel scheduling remains in `word_channel_stats`
- fast practice reads come from `practice_queue_entries`
- coverage/fairness state lives in `practice_queue_progress`
- API session cache stores the warmed session buffer

Request flow:

1. API validates deck ownership
2. API creates the practice session
3. API reads queue progress
4. API reads the next card from `practice_queue_entries`
5. API returns the first card immediately
6. API warms the remaining session buffer from the queue

## Data Model

### `practice_queue_entries`

Materialized read model keyed by user, deck, and word.

Fields:

- `deckId`
- `userId`
- `wordId`
- `position`
- `language`
- `target`
- `reading`
- `romanization`
- `meaning`
- `example`
- `audioUrl`
- `shapeStrength`
- `typingStrength`
- `listeningStrength`
- `shapeDueAt`
- `typingDueAt`
- `listeningDueAt`
- `weakestStrength`
- `nextDueAt`
- `lastPracticedAt`
- `updatedAt`

Indexes:

- `by_deck_word`
- `by_word`
- `by_user_deck_due_strength_position`
- `by_user_deck_position`

### `practice_queue_progress`

Per-user per-deck coverage cursor.

Fields:

- `userId`
- `deckId`
- `coverageCursorPosition`
- `updatedAt`

Index:

- `by_user_deck`

## Ranking Rules

Derived queue values:

- `weakestStrength = min(shapeStrength, typingStrength, listeningStrength)`
- `nextDueAt = min(shapeDueAt, typingDueAt, listeningDueAt)`

Ordering:

1. `nextDueAt` ascending
2. `weakestStrength` ascending
3. `position` relative to `coverageCursorPosition`

This preserves due-first scheduling while still preventing the same front slice of a large deck from dominating ties.

Default values for unseen words:

- strengths: `50`
- due timestamps: `now`
- `weakestStrength`: `50`
- `nextDueAt`: `now`

## Write Path Updates

Queue entries are updated synchronously during the write paths that already mutate practice state:

- word create
- batch create
- word content update
- word delete
- batch delete
- practice submit
- seed imports

This avoids introducing a worker system for the first iteration.

## Read Path

### Session Start

Session start now does:

1. deck lookup
2. session creation
3. queue progress lookup
4. `practiceQueue:getNextCard`
5. queue progress update
6. background buffer warm via `practiceQueue:listSessionBuffer`

### Session Submit

Submit now:

1. updates canonical `word_channel_stats`
2. updates queue entry stats for the practiced word
3. serves the next card from the warmed buffer if available
4. otherwise refills from `practice_queue_entries`

No live `deck_words` candidate scan remains in the practice hot path.

## Observability

Practice tracing remains enabled through the API layer.

Key fields for queue-backed traces:

- `queueProgressLookupMs`
- `queueFirstCardMs`
- `queueProgressUpdateMs`
- `queueBufferWarmMs`
- `updateQueueStatsMutationMs`

Success criteria:

- repeated production session starts no longer cluster around 3 to 4 seconds
- first-card queue read stays well below 1 second on a warm deployment
- no functional regression in session progression or due-card selection

## Backfill and Migration

Backfill script:

- `bun run backfill:practice-queue -- --prod`

The script paginates `deck_words`, upserts queue entries, initializes missing queue progress rows, and prints progress plus ETA.

The system is designed for direct cutover:

- start reading from the queue immediately after deploy
- run backfill to populate existing links
- use traces to verify the new queue read path

## Acceptance Criteria

- queue-backed session start serves the first card from `practice_queue_entries`
- session buffer warm uses queue reads only
- practice submit updates queue state synchronously
- large-deck starts remain varied across sessions through queue progress
- public API responses remain unchanged
