import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFunction } from "react-router-dom";
import type { TFunction } from "i18next";
import { api } from "../../../api/client";
import {
  buildSampleDeckWords,
  DASHBOARD_ONBOARDING_STORAGE_KEY,
  shouldShowDashboardOnboarding,
} from "../utils/dashboardOnboarding";
import { authQueryKey } from "../../../lib/queryKeys";

export function useDashboardOnboarding(input: {
  token: string | null;
  decksCount: number;
  recentSessionsCount: number;
  t: TFunction;
  navigate: NavigateFunction;
  queryClient: QueryClient;
}) {
  const [hasStartedPracticeFlag, setHasStartedPracticeFlag] = useState(false);
  const [createdSampleDeckId, setCreatedSampleDeckId] = useState<string | null>(null);
  const [sampleDeckDraftId, setSampleDeckDraftId] = useState<string | null>(null);
  const [isCreatingSampleDeck, setIsCreatingSampleDeck] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const localStorageApi = window.localStorage;
    if (!localStorageApi || typeof localStorageApi.getItem !== "function") return;
    setHasStartedPracticeFlag(localStorageApi.getItem(DASHBOARD_ONBOARDING_STORAGE_KEY) === "1");
  }, []);

  const shouldShowOnboarding = shouldShowDashboardOnboarding({
    decksCount: input.decksCount,
    recentSessionsCount: input.recentSessionsCount,
    hasStartedPracticeFlag,
  });

  const handleCreateSampleDeck = async () => {
    if (!input.token || isCreatingSampleDeck) return;

    setIsCreatingSampleDeck(true);
    setOnboardingError(null);
    try {
      const targetDeckId = sampleDeckDraftId ?? (
        await api.createDeck(input.token, {
          name: input.t("dashboard.onboarding.sample_deck_name", "Starter Japanese"),
          language: "ja",
        })
      ).id;

      setSampleDeckDraftId(targetDeckId);
      await api.createWordsBatch(input.token, targetDeckId, { words: buildSampleDeckWords() });
      setCreatedSampleDeckId(targetDeckId);
      await input.queryClient.invalidateQueries({ queryKey: authQueryKey(input.token, "decks") });
    } catch (error) {
      setOnboardingError(error instanceof Error ? error.message : input.t("errors.unknown", "Something went wrong."));
    } finally {
      setIsCreatingSampleDeck(false);
    }
  };

  const handleStartFirstPractice = () => {
    if (!createdSampleDeckId) return;

    const localStorageApi = typeof window === "undefined" ? null : window.localStorage;
    if (localStorageApi && typeof localStorageApi.setItem === "function") {
      localStorageApi.setItem(DASHBOARD_ONBOARDING_STORAGE_KEY, "1");
    }
    setHasStartedPracticeFlag(true);
    input.navigate(`/practice/${createdSampleDeckId}`);
  };

  const onboardingStepLabel = createdSampleDeckId
    ? input.t("dashboard.onboarding.step_label", { current: 2, total: 2, defaultValue: "Step 2 of 2" })
    : input.t("dashboard.onboarding.step_label", { current: 1, total: 2, defaultValue: "Step 1 of 2" });

  return {
    shouldShowOnboarding,
    createdSampleDeckId,
    isCreatingSampleDeck,
    onboardingError,
    onboardingStepLabel,
    handleCreateSampleDeck,
    handleStartFirstPractice,
  };
}
