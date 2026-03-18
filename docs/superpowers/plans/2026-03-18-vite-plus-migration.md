# Vite+ Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the workspace from split Vite/Vitest tooling to Vite+ while preserving current app behavior and command entrypoints.

**Architecture:** Update package versions to meet the migration preconditions, run the Vite+ migrator from the repo root, then reconcile any rewritten imports and config shape in the web app. Finish by validating the new command surface with install, check, test, and build.

**Tech Stack:** Bun workspaces, Vite+, Vitest, TypeScript, React

---

### Task 1: Raise Vite and Vitest to migration-ready versions

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/api/package.json`
- Modify: `packages/shared/package.json`

- [ ] Update `vite` to `^8.0.0` in the web package.
- [ ] Update every `vitest` dependency to `^4.1.0`.
- [ ] Keep the existing scripts intact until the migrator rewrites them.

### Task 2: Run the Vite+ migrator

**Files:**
- Modify: repo root workspace files as needed

- [ ] Run `vp migrate --no-interactive` from the workspace root.
- [ ] Inspect the rewritten package scripts, config files, and dependency changes.

### Task 3: Reconcile imports and config

**Files:**
- Modify: `apps/web/vite.config.ts`
- Modify: any test files or config files rewritten by the migrator

- [ ] Confirm `vite` imports now come from `vite-plus`.
- [ ] Confirm `vitest` imports now come from `vite-plus/test`.
- [ ] Move any leftover tool-specific config into the appropriate `vite.config.ts` blocks.
- [ ] Remove old `vite` and `vitest` dependencies only after the rewrites are confirmed.

### Task 4: Verify the migrated workspace

**Files:**
- None

- [ ] Run `vp install`.
- [ ] Run `vp check`.
- [ ] Run `vp test`.
- [ ] Run `vp build`.
- [ ] Summarize any remaining manual follow-up, if needed.
