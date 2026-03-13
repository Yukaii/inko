# Dashboard Onboarding Design

## Summary

Add a soft first-run onboarding experience to the dashboard that guides new users through two actions:

1. Create a sample starter deck in one click
2. Launch their first practice session immediately after setup

This onboarding is assistive, not blocking. Existing users should continue to land on the normal dashboard without interruption.

## Goals

- Reduce first-run confusion after login
- Replace the current empty-state dead end with a guided path
- Get a new user from account creation to first practice with the fewest decisions possible
- Reuse existing frontend queries and API endpoints instead of introducing new backend onboarding infrastructure

## Non-Goals

- Building a separate onboarding route or wizard
- Adding backend-managed starter deck templates
- Teaching full practice mechanics before the first session
- Reworking the broader dashboard information architecture

## User Experience

### Entry Conditions

Show the onboarding card on the dashboard when all of the following are true:

- the user is authenticated
- the user has no decks
- the user has no recent sessions

This makes the experience first-run specific and avoids showing onboarding to returning users who deleted old decks later.

### Step 1: Create Sample Deck

At the top of the dashboard, render a prominent onboarding card in place of the current minimal empty state.

The card should include:

- a clear headline that frames the first practice as the immediate goal
- a short explanation that Inko will prepare a sample deck for them
- a compact 2-step progress treatment
- one primary CTA to create the sample deck

When the user clicks the CTA, the client should:

1. create a new deck
2. insert a small starter set of words into that deck
3. invalidate relevant queries
4. transition the card into the launch state

During creation, the CTA should show a pending state and prevent duplicate submissions.

### Step 2: Start First Practice

After the sample deck is successfully prepared, the onboarding card should immediately switch to a launch-focused state.

That state should:

- confirm that the sample deck is ready
- keep the progress treatment visible, now emphasizing the final step
- present one dominant CTA to start practice with the new deck

Clicking the CTA should navigate the user into the standard practice flow for that deck.

### Exit Behavior

The onboarding card should disappear once the user has successfully launched the first practice session.

After that, the dashboard should behave normally. The sample deck should remain available like any other deck.

## Content Model

### Sample Deck

Seed the sample deck from a client-side constant in the web app.

The seed should be intentionally small:

- enough cards to make the first practice meaningful
- not so many that the setup feels heavy or opinionated

The first version should target Japanese only to keep scope narrow and match the app's current default deck-creation language.

Use a fixed starter set of 6 cards:

- こんにちは -> hello
- ありがとう -> thank you
- さようなら -> goodbye
- 水 -> water
- 猫 -> cat
- 学校 -> school

Each card may include reading and romanization where appropriate so the first practice session has enough structure to feel intentional without requiring backend seed management.

### Naming

Use a deterministic, user-friendly deck name that clearly communicates it is a starter deck. The name should be localized through the existing translation system.

## Technical Design

### Dashboard Responsibilities

[`apps/web/src/pages/DashboardPage.tsx`](/Users/yukai/Projects/Personal/inko/apps/web/src/pages/DashboardPage.tsx) becomes the orchestration point for onboarding display and actions.

It already has the required query context:

- current user
- decks
- dashboard stats
- recent sessions

Add derived onboarding state based on those queries and local action state:

- `shouldShowOnboarding`
- `createdSampleDeckId`
- `isCreatingSampleDeck`
- `isStartingFirstPractice`
- `onboardingError`

### API Usage

Reuse existing client APIs from [`apps/web/src/api/client.ts`](/Users/yukai/Projects/Personal/inko/apps/web/src/api/client.ts):

- `createDeck`
- `createWordsBatch`
- `startPractice`

No new endpoint is required for the first iteration.

### Query Invalidation

After sample deck creation succeeds, invalidate:

- decks query
- dashboard stats query if needed
- dashboard recent sessions query only after first practice launch or completion if the current flow depends on it

This keeps the dashboard in sync without introducing custom cache wiring beyond current patterns.

### Local Persistence

Store a small local flag after the first practice launch to avoid re-showing onboarding during edge cases such as query lag on navigation back to the dashboard.

This flag is defensive only. The source of truth remains dashboard data.

## Error Handling

### Sample Deck Creation Failure

If deck creation or starter-word insertion fails:

- keep the onboarding card visible
- show a concise inline error message
- allow the user to retry
- avoid leaving the UI in a fake-complete state

If deck creation succeeds but starter word insertion fails, keep the created deck rather than attempting rollback. The retry path can either continue populating that deck or create a new sample deck, but the first implementation should choose one predictable behavior and document it in code comments.

Required behavior: keep the partially created deck and retry populating the same deck if its identifier is available.

### Practice Launch Failure

If starting practice fails:

- keep the launch-state onboarding card visible
- preserve the created sample deck
- show an inline error and retry action

The user should not have to repeat deck creation just because the launch request failed.

## Testing

Add focused frontend tests that cover:

- onboarding card appears for authenticated users with no decks and no recent sessions
- onboarding card does not appear for users with existing decks
- sample deck CTA triggers deck creation and starter-word batch creation
- successful setup transitions to launch state
- launch CTA starts practice for the created sample deck
- failure states render retryable inline messaging

Mock API calls at the page level, following existing page test patterns.

## Rollout Notes

This is a self-contained frontend change. If it performs well and improves first-session conversion, a later version can move starter-deck templates to the backend or tailor them by selected language.
