import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { PracticeSimulator } from "../components/PracticeSimulator";
import { SUPPORTED_UI_LANGUAGES } from "../i18n";
import {
  Keyboard,
  Repeat,
  TrendingUp,
  Layers,
  Volume2,
  Smartphone,
  Globe,
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
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const currentLang = SUPPORTED_UI_LANGUAGES.find((l) => i18n.language.startsWith(l.code)) || SUPPORTED_UI_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-bg-page text-text-primary selection:bg-accent-orange/30">
      {/* Nav Bar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between bg-[#1A1A1A]/90 px-6 py-4 backdrop-blur-md md:px-12">
        <div className="flex items-center gap-10">
          <Link
            to="/"
            className="font-display text-xl font-semibold text-accent-orange hover:opacity-80 transition-opacity"
          >
            inko
          </Link>
          <div className="hidden items-center gap-6 md:flex font-mono text-sm text-text-secondary">
            <a href="#how-it-works" className="hover:text-text-primary transition-colors">
              {t("landing.nav.how_it_works")}
            </a>
            <a href="#features" className="hover:text-text-primary transition-colors">
              {t("landing.nav.features")}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              title={t("common.change_language")}
              className="flex items-center gap-2 rounded-full bg-accent-orange px-4 py-2 font-mono text-xs font-bold text-text-on-accent transition-transform hover:scale-105 active:scale-95 border-0"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="min-w-[20px] text-left uppercase">{currentLang.short}</span>
              <span className={`text-[8px] transition-transform duration-200 ${showLangMenu ? "rotate-180" : ""}`}>▼</span>
            </button>
            
            <AnimatePresence>
              {showLangMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 mt-2 flex w-40 flex-col gap-1 overflow-hidden rounded-xl border border-white/10 bg-[#1A1A1A] p-1.5 shadow-2xl ring-1 ring-black/50"
                >
                  {SUPPORTED_UI_LANGUAGES.map((lang) => {
                    const isActive = i18n.language.startsWith(lang.code);
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          void i18n.changeLanguage(lang.code);
                          setShowLangMenu(false);
                        }}
                        className={`flex w-full items-center rounded-lg px-3 py-2 text-left font-mono text-[11px] font-bold transition-all border-0 ${
                          isActive 
                            ? "bg-accent-teal text-text-on-accent" 
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <GetStartedLink
            className="rounded-xl bg-accent-orange px-5 py-2 font-mono text-xs font-bold text-text-on-accent transition-transform hover:scale-105 active:scale-95 no-underline"
          >
            {t("landing.nav.get_started")}
          </GetStartedLink>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center pt-20 pb-16 px-6 text-center md:px-30">
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex flex-col items-center"
        >
          <motion.div 
            variants={fadeInUp}
            className="mb-8 inline-flex items-center justify-center rounded-full bg-bg-elevated px-4 py-1.5 font-mono text-[10px] font-bold text-accent-teal uppercase tracking-widest border border-accent-teal/20"
          >
            TYPE IT UNTIL YOU OWN IT
          </motion.div>
          <motion.h1 
            variants={fadeInUp}
            className="mb-6 font-display text-5xl font-bold leading-tight md:text-7xl"
          >
            {t("landing.hero.title")}
          </motion.h1>
          <motion.p 
            variants={fadeInUp}
            className="mb-10 max-w-[600px] font-mono text-base text-text-secondary md:text-lg leading-relaxed"
          >
            {t("landing.hero.subtitle")}
          </motion.p>
          <motion.div 
            variants={fadeInUp}
            className="mb-20 flex flex-col gap-4 sm:flex-row sm:gap-6 font-mono font-semibold"
          >
            <GetStartedLink
              className="rounded-base bg-accent-orange px-7 py-3.5 text-text-on-accent transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-accent-orange/20"
            >
              {t("landing.hero.cta_primary")}
            </GetStartedLink>
            <a
              href="#how-it-works"
              className="rounded-base border border-text-primary px-7 py-3.5 text-text-primary transition-colors hover:bg-bg-elevated"
            >
              {t("landing.hero.cta_secondary")}
            </a>
          </motion.div>
        </motion.div>

        {/* Mockup Simulator */}
        <motion.div 
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-[1103px] mb-12"
        >
          <div className="flex h-[39px] items-center gap-2 rounded-t-2xl bg-[#1a1a1a] px-4">
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
            <p className="font-mono text-sm text-text-secondary">
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
                  <h3 className="mb-2 font-mono font-bold text-text-primary">{step.title}</h3>
                  <p className="font-mono text-sm leading-relaxed text-text-secondary">
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
            <p className="max-w-[500px] font-mono text-sm text-text-secondary">
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
                icon: Smartphone,
                title: t("landing.features.practice_anywhere.title"),
                desc: t("landing.features.practice_anywhere.desc"),
                color: "text-accent-teal",
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
                <p className="font-mono text-sm leading-relaxed text-text-secondary">
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
          className="mx-auto max-w-[1200px] flex flex-col items-center text-center gap-8 rounded-[24px] bg-gradient-to-t from-[#1A1A1A] to-[#2D2D2D] p-12 md:p-20 shadow-2xl shadow-black/50"
        >
          <h2 className="font-display text-4xl md:text-[64px] font-bold leading-tight text-text-primary">
            {t("landing.cta.title")}
          </h2>
          <p className="max-w-[550px] font-mono text-sm md:text-base leading-relaxed text-text-secondary">
            {t("landing.cta.subtitle")}
          </p>
          <div className="flex flex-col items-center gap-4 mt-4">
            <GetStartedLink
              className="rounded-base bg-accent-orange px-8 py-4 font-mono font-semibold text-text-on-accent transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-accent-orange/20"
            >
              {t("landing.cta.button")}
            </GetStartedLink>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-[#111] py-12 px-6 md:px-30">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-12 md:flex-row md:gap-0 pb-12">
            <div className="flex max-w-[300px] flex-col gap-4">
              <span className="font-display text-2xl font-bold text-accent-orange">
                inko_
              </span>
              <p className="font-mono text-xs leading-relaxed text-text-secondary">
                {t("landing.footer.desc")}
              </p>
            </div>
            <div className="flex flex-wrap gap-16 font-mono text-sm">
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
          <div className="h-[1px] w-full bg-[#2D2D2D] mb-6" />
          <div className="flex flex-col sm:flex-row items-center justify-between font-mono text-xs text-[#555]">
            <span>{t("landing.footer.rights")}</span>
            <span>{t("landing.footer.built_with")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
