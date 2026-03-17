import type { TFunction } from "i18next";

export function DashboardOnboardingPanel({
  t,
  stepLabel,
  createdSampleDeckId,
  onboardingError,
  isCreatingSampleDeck,
  onCreateSampleDeck,
  onStartFirstPractice,
}: {
  t: TFunction;
  stepLabel: string;
  createdSampleDeckId: string | null;
  onboardingError: string | null;
  isCreatingSampleDeck: boolean;
  onCreateSampleDeck: () => void;
  onStartFirstPractice: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-accent-orange/30 bg-bg-card px-8 py-8 text-left text-text-secondary">
      <div className="flex flex-col gap-3">
        <p className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-accent-orange">
          {stepLabel}
        </p>
        {createdSampleDeckId ? (
          <>
            <h3 className="m-0 text-[28px] leading-tight font-semibold [font-family:var(--font-display)] text-text-primary">
              {t("dashboard.onboarding.launch_title", "Your sample deck is ready")}
            </h3>
            <p className="m-0 max-w-xl text-sm leading-6">
              {t("dashboard.onboarding.launch_body", "Jump straight into your first practice session.")}
            </p>
            <div>
              <button
                type="button"
                onClick={onStartFirstPractice}
                className="inline-flex items-center justify-center rounded-[16px] bg-accent-orange px-5 py-3 font-semibold text-text-on-accent transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                {t("dashboard.onboarding.launch_cta", "Start first practice")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="m-0 text-[28px] leading-tight font-semibold [font-family:var(--font-display)] text-text-primary">
              {t("dashboard.onboarding.title", "Create your sample deck")}
            </h3>
            <p className="m-0 max-w-xl text-sm leading-6">
              {t(
                "dashboard.onboarding.body",
                "We'll set up a starter deck so you can begin practicing right away.",
              )}
            </p>
            {onboardingError ? <p className="m-0 text-sm text-[var(--danger-text,#b42318)]">{onboardingError}</p> : null}
            <div>
              <button
                type="button"
                onClick={onCreateSampleDeck}
                disabled={isCreatingSampleDeck}
                className="inline-flex items-center justify-center rounded-[16px] bg-accent-orange px-5 py-3 font-semibold text-text-on-accent transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCreatingSampleDeck
                  ? t("common.creating", "Creating...")
                  : onboardingError
                    ? t("dashboard.onboarding.retry", "Try again")
                    : t("dashboard.onboarding.create_cta", "Create sample deck")}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
