import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { PracticeSimulator } from "../components/PracticeSimulator";
import { PublicNavbar } from "../components/PublicNavbar";
import { applyMetadata } from "../lib/seo";
import {
  Keyboard,
  Repeat,
  TrendingUp,
  Layers,
  Volume2,
  BookOpenText,
  FileUp,
  Library,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

function GetStartedLink({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link to="/dashboard" className={className}>
      {children}
    </Link>
  );
}

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const heroProofs = [
    { icon: FileUp, label: t("landing.hero.proof_import") },
    { icon: Keyboard, label: t("landing.hero.proof_typing") },
    { icon: BookOpenText, label: t("landing.hero.proof_reading") },
    { icon: Library, label: t("landing.hero.proof_community") },
  ];

  useEffect(() => {
    applyMetadata({
      title: t("landing.meta.title"),
      description:
        t("landing.meta.description"),
      path: "/",
      robots: "index,follow",
    });
  }, [i18n.resolvedLanguage, t]);

  return (
    <div className="min-h-screen bg-bg-page text-text-primary selection:bg-accent-orange/30">
      <PublicNavbar showAnchors />

      <main id="main-content">
        {/* Hero Section */}
        <section className="px-6 py-7 md:px-12 md:py-10 lg:px-30">
          <div className="mx-auto grid max-w-6xl items-center gap-6 md:gap-10 lg:min-h-[calc(100vh-210px)] lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-col items-start text-left"
            >
              <motion.h1
                variants={fadeInUp}
                className="mb-5 font-display text-4xl font-bold leading-[0.98] sm:text-5xl md:mb-6 md:text-6xl xl:text-7xl"
              >
                {t("landing.hero.title")}
              </motion.h1>
              <motion.p
                variants={fadeInUp}
                className="mb-6 max-w-[620px] text-base leading-relaxed text-text-secondary md:mb-8 md:text-lg"
              >
                {t("landing.hero.subtitle")}
              </motion.p>
              <motion.div
                variants={fadeInUp}
                className="mb-5 flex w-full flex-col gap-3 font-semibold sm:w-auto sm:flex-row md:mb-7"
              >
                <GetStartedLink
                  className="rounded-base bg-accent-orange px-7 py-3 text-center text-text-on-accent shadow-lg shadow-accent-orange/20 transition-transform hover:scale-[1.03] active:scale-95 md:py-3.5"
                >
                  {t("landing.hero.cta_primary")}
                </GetStartedLink>
                <a
                  href="#how-it-works"
                  className="rounded-base border border-[var(--border-strong)] px-7 py-3 text-center text-text-primary transition-colors hover:bg-bg-elevated md:py-3.5"
                >
                  {t("landing.hero.cta_secondary")}
                </a>
              </motion.div>
              <motion.div
                variants={fadeInUp}
                className="grid w-full gap-2 text-[13px] text-text-secondary sm:grid-cols-2 lg:grid-cols-4 md:gap-3 lg:max-w-[640px]"
              >
                {heroProofs.map((proof) => (
                  <div
                    key={proof.label}
                    className="flex items-center gap-2 rounded-[12px] border border-[var(--border-subtle)] bg-bg-card/70 px-3 py-2 md:py-2.5"
                  >
                    <proof.icon className="h-4 w-4 shrink-0 text-accent-teal" />
                    <span className="whitespace-nowrap leading-snug">{proof.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Mockup Simulator */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="hidden w-full min-w-0 md:block"
            >
              <div className="flex h-[32px] items-center gap-2 rounded-t-2xl bg-[#1a1a1a] px-4 shadow-[0_24px_80px_var(--shadow)] md:h-[36px]">
                <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <PracticeSimulator />
            </motion.div>
          </div>
        </section>

        <section className="px-6 pb-10 md:hidden">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="w-full min-w-0"
          >
            <div className="flex h-[32px] items-center gap-2 rounded-t-2xl bg-[#1a1a1a] px-4 shadow-[0_24px_80px_var(--shadow)]">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <PracticeSimulator />
          </motion.div>
        </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-bg-card py-20 px-6 md:px-30">
        <div className="mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="mb-12 flex flex-col gap-2"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary">
              {t("landing.how_it_works.title")}
            </h2>
            <p className="text-sm text-text-secondary">
              {t("landing.how_it_works.subtitle")}
            </p>
          </motion.div>
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-3"
          >
            {[
              { num: "01", title: t("landing.how_it_works.step1.title"), desc: t("landing.how_it_works.step1.desc") },
              { num: "02", title: t("landing.how_it_works.step2.title"), desc: t("landing.how_it_works.step2.desc") },
              { num: "03", title: t("landing.how_it_works.step3.title"), desc: t("landing.how_it_works.step3.desc") }
            ].map((step) => (
              <motion.div
                key={step.num}
                variants={fadeInUp}
                whileHover={{ y: -5 }}
                className="flex flex-col gap-4 rounded-base bg-bg-elevated p-6 transition-colors border border-transparent hover:border-accent-teal/30"
              >
                <div className="flex items-center justify-between font-display">
                  <span className="text-xl font-bold">{t("common.step", "Step")} {step.num}</span>
                  <div className="h-8 w-8 rounded-full bg-bg-card flex items-center justify-center text-accent-teal font-bold">{step.num.replace('0','')}</div>
                </div>
                <div>
                  <h3 className="mb-2 font-bold text-text-primary">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 md:px-30 bg-bg-page">
        <div className="mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 flex flex-col items-center text-center gap-4"
          >
            <div className="inline-flex rounded-base bg-bg-elevated px-3 py-1.5 font-mono text-[11px] font-semibold text-accent-teal">
              {t("landing.features.badge")}
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary">
              {t("landing.features.title")}
            </h2>
            <p className="max-w-[500px] text-sm text-text-secondary">
              {t("landing.features.subtitle")}
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {[
              {
                icon: Keyboard,
                title: t("landing.features.typing_first.title"),
                desc: t("landing.features.typing_first.desc"),
                color: "text-accent-orange",
              },
              {
                icon: Repeat,
                title: t("landing.features.spaced_repetition.title"),
                desc: t("landing.features.spaced_repetition.desc"),
                color: "text-accent-orange",
              },
              {
                icon: TrendingUp,
                title: t("landing.features.progress_tracking.title"),
                desc: t("landing.features.progress_tracking.desc"),
                color: "text-accent-teal",
              },
              {
                icon: Layers,
                title: t("landing.features.custom_decks.title"),
                desc: t("landing.features.custom_decks.desc"),
                color: "text-accent-teal",
              },
              {
                icon: Volume2,
                title: t("landing.features.tts_support.title"),
                desc: t("landing.features.tts_support.desc"),
                color: "text-accent-orange",
              },
              {
                icon: BookOpenText,
                title: t("landing.features.reading_mode.title"),
                desc: t("landing.features.reading_mode.desc"),
                color: "text-accent-orange",
              },
            ].map((feat, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                whileHover={{ scale: 1.02 }}
                className="flex flex-col gap-4 rounded-base bg-bg-card p-6 border border-transparent hover:border-text-secondary/20 transition-all shadow-sm hover:shadow-md"
              >
                <feat.icon className={`h-6 w-6 ${feat.color}`} />
                <h3 className="font-display text-xl font-semibold text-text-primary">
                  {feat.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-bg-page py-24 px-6 md:px-30">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mx-auto flex max-w-[1200px] flex-col items-center gap-8 rounded-[24px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.12),transparent_35%),linear-gradient(180deg,var(--bg-card),var(--bg-elevated))] p-12 text-center shadow-[0_24px_80px_var(--shadow)] md:p-20"
        >
          <h2 className="font-display text-4xl md:text-[64px] font-bold leading-tight text-text-primary">
            {t("landing.cta.title")}
          </h2>
          <p className="max-w-[550px] text-sm leading-relaxed text-text-secondary md:text-base">
            {t("landing.cta.subtitle")}
          </p>
          <div className="flex flex-col items-center gap-4 mt-4">
            <GetStartedLink
              className="rounded-base bg-accent-orange px-8 py-4 font-semibold text-text-on-accent shadow-lg shadow-accent-orange/20 transition-transform hover:scale-105 active:scale-95"
            >
              {t("landing.cta.button")}
            </GetStartedLink>
          </div>
        </motion.div>
      </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[linear-gradient(180deg,var(--bg-page),var(--bg-card))] py-12 px-6 md:px-30">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-12 rounded-[24px] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--bg-card)_82%,var(--bg-page))] px-8 py-10 md:flex-row md:gap-0">
            <div className="flex max-w-[300px] flex-col gap-4">
              <span className="font-display text-2xl font-bold text-accent-orange">
                inko_
              </span>
              <p className="text-xs leading-relaxed text-text-secondary">
                {t("landing.footer.desc")}
              </p>
            </div>
            <div className="flex flex-wrap gap-16 text-sm">
              <div className="flex flex-col gap-3">
                <span className="font-bold text-text-primary mb-2">{t("landing.footer.product")}</span>
                <a href="#features" className="text-text-secondary hover:text-accent-teal transition-colors">{t("landing.nav.features")}</a>
                <a href="#how-it-works" className="text-text-secondary hover:text-accent-teal transition-colors">{t("landing.nav.how_it_works")}</a>
                <a
                  href="https://github.com/Yukaii/inko"
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-secondary hover:text-accent-teal transition-colors"
                >
                  {t("landing.footer.github")}
                </a>
              </div>
            </div>
          </div>
          <div className="mb-6 mt-6 h-[1px] w-full bg-[var(--border-subtle)]" />
          <div className="flex flex-col items-center justify-between text-xs text-text-secondary sm:flex-row">
            <span>{t("landing.footer.rights")}</span>
            <span>{t("landing.footer.built_with")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
