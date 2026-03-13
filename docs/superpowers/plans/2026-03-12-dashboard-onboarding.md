# Dashboard Onboarding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a soft dashboard onboarding flow that lets first-run users create a sample Japanese starter deck and immediately launch their first practice session.

**Architecture:** Keep onboarding inside the existing dashboard page and derive visibility from existing `decks` and `recentSessions` queries. Add a small dashboard-local helper module for starter deck seed data and onboarding persistence, then wire dashboard mutations to `createDeck`, `createWordsBatch`, and route navigation into the existing practice flow.

**Tech Stack:** React 19, React Router, TanStack Query, Vitest, Testing Library, i18next, Bun

---

## File Structure

- Create: `apps/web/src/pages/DashboardPage.test.tsx`
  Purpose: page-level tests for first-run onboarding states, success transitions, and error handling
- Create: `apps/web/src/pages/dashboardOnboarding.ts`
  Purpose: small helper module for sample deck seed data, first-run visibility helpers, and local storage key helpers
- Modify: `apps/web/src/pages/DashboardPage.tsx`
  Purpose: render onboarding card, orchestrate sample deck creation and first-practice launch, preserve existing dashboard behavior for returning users
- Modify: `apps/web/src/locales/en.json`
  Purpose: add onboarding copy and sample deck naming strings
- Modify: `apps/web/src/locales/ja.json`
  Purpose: keep Japanese locale complete for new onboarding strings
- Modify: `apps/web/src/locales/zh-TW.json`
  Purpose: keep Traditional Chinese locale complete for new onboarding strings

## Chunk 1: Test Harness And Helper Module

### Task 1: Add failing onboarding visibility test

**Files:**
- Create: `apps/web/src/pages/DashboardPage.test.tsx`
- Reference: `apps/web/src/pages/PracticePage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("shows onboarding for a first-run user with no decks and no recent sessions", async () => {
  mockListDecks.mockResolvedValue([]);
  mockDashboardRecentSessions.mockResolvedValue({ recentSessions: [] });
  mockDashboardStats.mockResolvedValue({
    totalWordsLearned: 0,
    wordsDueToday: 0,
    learningStreak: 0,
    sessionTimeSeconds: 0,
  });
  mockMe.mockResolvedValue({
    id: "user-1",
    email: "user@example.com",
    displayName: "Aki",
    themeMode: "system",
    typingMode: "language_specific",
    ttsEnabled: true,
    srsConfig: { newCardsPerDay: 20, reviewsPerDay: 200, targetRetention: 0.9 },
    canModerateCommunity: false,
    themes: {
      light: {
        accentOrange: "#ff6b35",
        accentTeal: "#0f766e",
        bgPage: "#f6f4ef",
        bgCard: "#ffffff",
        bgElevated: "#ece7df",
        textPrimary: "#111827",
        textSecondary: "#4b5563",
        textOnAccent: "#111827",
      },
      dark: {
        accentOrange: "#ff6b35",
        accentTeal: "#14b8a6",
        bgPage: "#111827",
        bgCard: "#1f2937",
        bgElevated: "#374151",
        textPrimary: "#f9fafb",
        textSecondary: "#9ca3af",
        textOnAccent: "#111827",
      },
    },
    createdAt: 1,
  });

  renderDashboardPage();

  expect(await screen.findByText("Create your sample deck")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create sample deck" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: FAIL because `DashboardPage.test.tsx` does not exist yet and the onboarding UI is not implemented

- [ ] **Step 3: Create the page test harness**

```tsx
/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
```

Mirror the mocking style from `apps/web/src/pages/PracticePage.test.tsx`:

- mock `../api/client`
- mock `../hooks/useAuth`
- mock `react-i18next`
- stub `useNavigate`

- [ ] **Step 4: Run test to verify it still fails for the right reason**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: FAIL on missing onboarding copy in rendered dashboard, not on harness/setup errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DashboardPage.test.tsx
git commit -m "test: add dashboard onboarding harness"
```

### Task 2: Add helper module for seed data and onboarding persistence

**Files:**
- Create: `apps/web/src/pages/dashboardOnboarding.ts`
- Test: `apps/web/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing unit-style tests for helper behavior**

Add tests for:

- `shouldShowDashboardOnboarding({ decksCount: 0, recentSessionsCount: 0, hasDismissedLaunch: false }) === true`
- `shouldShowDashboardOnboarding({ decksCount: 1, recentSessionsCount: 0, hasDismissedLaunch: false }) === false`
- sample deck seed returns 6 Japanese cards

```tsx
expect(buildSampleDeckWords()).toHaveLength(6);
expect(buildSampleDeckWords()[0]).toMatchObject({
  target: "こんにちは",
  meaning: "hello",
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: FAIL because helper exports do not exist

- [ ] **Step 3: Write minimal helper implementation**

```ts
import type { CreateWordInput } from "@inko/shared";

export const DASHBOARD_ONBOARDING_STORAGE_KEY = "inko_dashboard_onboarding_started";

export function shouldShowDashboardOnboarding(input: {
  decksCount: number;
  recentSessionsCount: number;
  hasStartedPracticeFlag: boolean;
}) {
  return input.decksCount === 0 && input.recentSessionsCount === 0 && !input.hasStartedPracticeFlag;
}

export function buildSampleDeckWords(): CreateWordInput[] {
  return [
    { target: "こんにちは", reading: "こんにちは", romanization: "konnichiwa", meaning: "hello" },
    { target: "ありがとう", reading: "ありがとう", romanization: "arigatou", meaning: "thank you" },
    { target: "さようなら", reading: "さようなら", romanization: "sayounara", meaning: "goodbye" },
    { target: "水", reading: "みず", romanization: "mizu", meaning: "water" },
    { target: "猫", reading: "ねこ", romanization: "neko", meaning: "cat" },
    { target: "学校", reading: "がっこう", romanization: "gakkou", meaning: "school" },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: PASS for helper assertions; onboarding UI test still failing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/dashboardOnboarding.ts apps/web/src/pages/DashboardPage.test.tsx
git commit -m "feat: add dashboard onboarding seed helpers"
```

## Chunk 2: Dashboard Onboarding UI And Mutations

### Task 3: Render onboarding card for first-run users

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Test: `apps/web/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Add failing UI assertions for onboarding card copy**

```tsx
expect(await screen.findByText("Create your sample deck")).toBeInTheDocument();
expect(screen.getByText("We’ll set up a starter deck so you can begin practicing right away.")).toBeInTheDocument();
expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: FAIL because `DashboardPage` still renders the old empty state

- [ ] **Step 3: Implement minimal onboarding render path**

In `apps/web/src/pages/DashboardPage.tsx`:

- import helper functions from `./dashboardOnboarding`
- derive `recentSessionsCount`
- read local storage flag inside a guarded `useEffect`
- compute `shouldShowOnboarding`
- replace the current `activeDecks.length === 0` empty-state section with conditional onboarding UI before falling back to the old empty state

Keep the first implementation simple:

```tsx
const [hasStartedPracticeFlag, setHasStartedPracticeFlag] = useState(false);
const shouldShowOnboarding = shouldShowDashboardOnboarding({
  decksCount: decks.length,
  recentSessionsCount: sessionsQuery.data?.recentSessions.length ?? 0,
  hasStartedPracticeFlag,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: PASS for onboarding visibility and copy assertions

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/pages/DashboardPage.test.tsx
git commit -m "feat: show dashboard onboarding for first-run users"
```

### Task 4: Implement sample deck creation flow

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Test: `apps/web/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing mutation test for sample deck creation**

```tsx
it("creates a sample deck and starter words from onboarding", async () => {
  mockCreateDeck.mockResolvedValue({
    id: "deck-sample",
    userId: "user-1",
    name: "Starter Japanese",
    language: "ja",
    archived: false,
    ttsEnabled: true,
    ttsVoice: "ja-JP-NanamiNeural",
    ttsRate: "default",
    createdAt: 1,
  });
  mockCreateWordsBatch.mockResolvedValue({ created: 6, words: [] });

  renderDashboardPage();
  fireEvent.click(await screen.findByRole("button", { name: "Create sample deck" }));

  await waitFor(() => {
    expect(mockCreateDeck).toHaveBeenCalledWith("test-token", { name: "Starter Japanese", language: "ja" });
    expect(mockCreateWordsBatch).toHaveBeenCalledWith("test-token", "deck-sample", { words: buildSampleDeckWords() });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: FAIL because no onboarding mutation handler exists

- [ ] **Step 3: Implement the mutation flow**

In `DashboardPage.tsx`:

- add local states for `createdSampleDeckId`, `isCreatingSampleDeck`, `onboardingError`
- add `handleCreateSampleDeck`
- create deck first
- populate it with `createWordsBatch`
- invalidate `authQueryKey(token, "decks")`
- set the created deck id for the launch state

Keep logic linear and local:

```ts
const deck = await api.createDeck(token ?? "", { name: t("dashboard.onboarding.sample_deck_name"), language: "ja" });
await api.createWordsBatch(token ?? "", deck.id, { words: buildSampleDeckWords() });
setCreatedSampleDeckId(deck.id);
await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "decks") });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: PASS for create flow; no regression in onboarding visibility test

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/pages/DashboardPage.test.tsx
git commit -m "feat: create sample deck from dashboard onboarding"
```

### Task 5: Implement launch-state onboarding and start-practice CTA

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Test: `apps/web/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Add failing launch-state tests**

Add assertions for:

- launch state appears after sample deck creation
- CTA calls `navigate("/practice/deck-sample")`
- onboarding hides after successful launch flag is set

```tsx
expect(await screen.findByText("Your sample deck is ready")).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "Start first practice" }));
expect(mockNavigate).toHaveBeenCalledWith("/practice/deck-sample");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: FAIL because dashboard has only create state

- [ ] **Step 3: Implement launch state**

In `DashboardPage.tsx`:

- branch onboarding UI by `createdSampleDeckId`
- add `handleStartFirstPractice`
- set `localStorage.setItem(DASHBOARD_ONBOARDING_STORAGE_KEY, "1")`
- navigate to `/practice/${createdSampleDeckId}`

Do not call `api.startPractice` directly from dashboard; preserve the current route-based practice startup model already implemented by `PracticePage.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: PASS for launch-state transition and navigation behavior

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/pages/DashboardPage.test.tsx apps/web/src/pages/dashboardOnboarding.ts
git commit -m "feat: add first-practice launch state to dashboard onboarding"
```

## Chunk 3: Error States, Localization, And Verification

### Task 6: Add retryable error handling tests and implementation

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Test: `apps/web/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing error-state tests**

Cover both:

- create words batch fails after deck creation
- start-practice launch preparation fails only if local storage or navigation setup throws

Primary required case:

```tsx
mockCreateDeck.mockResolvedValue(sampleDeck);
mockCreateWordsBatch.mockRejectedValue(new Error("Seed failed"));

renderDashboardPage();
fireEvent.click(await screen.findByRole("button", { name: "Create sample deck" }));

expect(await screen.findByText("Seed failed")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: FAIL because onboarding does not render retry messaging

- [ ] **Step 3: Implement minimal retryable error handling**

In `DashboardPage.tsx`:

- preserve created deck id when batch creation fails
- store a separate `sampleDeckDraftId`
- retry population against the same deck when available
- render inline error message and retry CTA

Minimal retry logic:

```ts
const targetDeckId = sampleDeckDraftId ?? createdDeck.id;
await api.createWordsBatch(token ?? "", targetDeckId, { words: buildSampleDeckWords() });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: PASS for failure and retry rendering

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/pages/DashboardPage.test.tsx
git commit -m "feat: add retryable dashboard onboarding errors"
```

### Task 7: Add localized onboarding strings

**Files:**
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/ja.json`
- Modify: `apps/web/src/locales/zh-TW.json`
- Test: `apps/web/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Add failing assertions that use translation keys through `t()`**

Replace hard-coded English in tests where useful with key-driven fallbacks, then add assertions for the final copy set:

- `dashboard.onboarding.title`
- `dashboard.onboarding.body`
- `dashboard.onboarding.step_create`
- `dashboard.onboarding.step_launch`
- `dashboard.onboarding.create_cta`
- `dashboard.onboarding.launch_title`
- `dashboard.onboarding.launch_cta`
- `dashboard.onboarding.retry`
- `dashboard.onboarding.sample_deck_name`

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: FAIL because locale keys do not exist

- [ ] **Step 3: Implement translation entries**

Add a nested `dashboard.onboarding` group in each locale file.

English baseline:

```json
"onboarding": {
  "title": "Create your sample deck",
  "body": "We’ll set up a starter deck so you can begin practicing right away.",
  "step_label": "Step {{current}} of {{total}}",
  "step_create": "Create sample deck",
  "step_launch": "Start first practice",
  "create_cta": "Create sample deck",
  "launch_title": "Your sample deck is ready",
  "launch_body": "Jump straight into your first practice session.",
  "launch_cta": "Start first practice",
  "retry": "Try again",
  "sample_deck_name": "Starter Japanese"
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx`
Expected: PASS

Run: `bun run --filter @inko/web lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/locales/en.json apps/web/src/locales/ja.json apps/web/src/locales/zh-TW.json apps/web/src/pages/DashboardPage.test.tsx
git commit -m "feat: add dashboard onboarding copy"
```

### Task 8: Full verification and cleanup

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Modify: `apps/web/src/pages/dashboardOnboarding.ts`
- Modify: `apps/web/src/pages/DashboardPage.test.tsx`
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/ja.json`
- Modify: `apps/web/src/locales/zh-TW.json`

- [ ] **Step 1: Run targeted web tests**

Run: `bun run --filter @inko/web test -- DashboardPage.test.tsx PracticePage.test.tsx`
Expected: PASS

- [ ] **Step 2: Run full web test suite**

Run: `bun run --filter @inko/web test`
Expected: PASS

- [ ] **Step 3: Run workspace lint relevant to changed code**

Run: `bun run --filter @inko/web lint`
Expected: PASS

- [ ] **Step 4: Run full workspace checks if time permits before handoff**

Run: `bun run test`
Expected: PASS across shared, api, and web packages

Run: `bun run lint`
Expected: PASS across shared, api, and web packages

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/pages/dashboardOnboarding.ts apps/web/src/pages/DashboardPage.test.tsx apps/web/src/locales/en.json apps/web/src/locales/ja.json apps/web/src/locales/zh-TW.json
git commit -m "feat: add dashboard onboarding flow"
```
