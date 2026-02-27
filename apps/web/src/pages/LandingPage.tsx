import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PracticeSimulator } from "../components/PracticeSimulator";
import {
  Keyboard,
  Repeat,
  TrendingUp,
  Layers,
  Zap,
  Smartphone,
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

export function LandingPage() {
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
              how_it_works
            </a>
            <a href="#features" className="hover:text-text-primary transition-colors">
              features
            </a>
          </div>
        </div>
        <Link
          to="/login"
          className="rounded-base bg-accent-orange px-5 py-2.5 font-mono text-xs font-semibold text-text-on-accent transition-transform hover:scale-105 active:scale-95"
        >
          get_started
        </Link>
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
            className="mb-8 inline-flex items-center justify-center rounded-full bg-bg-elevated px-3 py-1.5 font-mono text-[10px] font-bold text-accent-teal uppercase tracking-wider"
          >
            THE_FUTURE_OF_RETENTION
          </motion.div>
          <motion.h1 
            variants={fadeInUp}
            className="mb-6 font-display text-5xl font-bold leading-tight md:text-7xl"
          >
            type it until you own it
          </motion.h1>
          <motion.p 
            variants={fadeInUp}
            className="mb-10 max-w-[600px] font-mono text-base text-text-secondary md:text-lg leading-relaxed"
          >
            The flashcard app that makes you prove you know it. Type your answers,
            build muscle memory, and never forget again.
          </motion.p>
          <motion.div 
            variants={fadeInUp}
            className="mb-20 flex flex-col gap-4 sm:flex-row sm:gap-6 font-mono font-semibold"
          >
            <Link
              to="/login"
              className="rounded-base bg-accent-orange px-7 py-3.5 text-text-on-accent transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-accent-orange/20"
            >
              Start Typing
            </Link>
            <a
              href="#how-it-works"
              className="rounded-base border border-text-primary px-7 py-3.5 text-text-primary transition-colors hover:bg-bg-elevated"
            >
              Learn More
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
              // how_it_works
            </h2>
            <p className="font-mono text-sm text-text-secondary">
              Three steps to never forgetting again
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
              { num: "01", title: "Create Decks", desc: "Build custom decks for any subject. Add your terms and definitions." },
              { num: "02", title: "Type Answers", desc: "No multiple choice. Recall the answer from memory and type it out." },
              { num: "03", title: "Review Smartly", desc: "Our algorithm schedules reviews just before you're likely to forget." }
            ].map((step) => (
              <motion.div
                key={step.num}
                variants={fadeInUp}
                whileHover={{ y: -5 }}
                className="flex flex-col gap-4 rounded-base bg-bg-elevated p-6 transition-colors border border-transparent hover:border-accent-teal/30"
              >
                <div className="flex items-center justify-between font-display">
                  <span className="text-xl font-bold">Step {step.num}</span>
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
              // features
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary">
              everything_you_need
            </h2>
            <p className="max-w-[500px] font-mono text-sm text-text-secondary">
              Built for learners who want real retention, not just recognition.
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
                title: "typing_first",
                desc: "No multiple choice. No matching. Type your answers from memory to build real neural pathways.",
                color: "text-accent-orange",
              },
              {
                icon: Repeat,
                title: "spaced_repetition",
                desc: "Smart scheduling surfaces cards right before you forget. Every review is perfectly timed.",
                color: "text-accent-orange",
              },
              {
                icon: TrendingUp,
                title: "progress_tracking",
                desc: "Visual dashboards show mastery levels, streaks, and weak spots so you know exactly where to focus.",
                color: "text-accent-teal",
              },
              {
                icon: Layers,
                title: "custom_decks",
                desc: "Create decks for any subject — languages, code syntax, med terms, history dates. Your knowledge, your way.",
                color: "text-accent-teal",
              },
              {
                icon: Zap,
                title: "streak_system",
                desc: "Daily streaks and scoring keep you motivated. Consistency beats cramming every time.",
                color: "text-accent-orange",
              },
              {
                icon: Smartphone,
                title: "practice_anywhere",
                desc: "Works on any device with a keyboard. Practice on your commute, at your desk, or in bed.",
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
            Master anything by typing.
          </h2>
          <p className="max-w-[550px] font-mono text-sm md:text-base leading-relaxed text-text-secondary">
            Type your way to lasting knowledge. Free to start.
          </p>
          <div className="flex flex-col items-center gap-4 mt-4">
            <Link
              to="/login"
              className="rounded-base bg-accent-orange px-8 py-4 font-mono font-semibold text-text-on-accent transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-accent-orange/20"
            >
              Start Typing Now
            </Link>
            <span className="font-mono text-xs text-text-secondary">
              // it's free, forever
            </span>
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
                Type it until you own it. The flashcard app that builds real
                recall through active typing practice.
              </p>
            </div>
            <div className="flex flex-wrap gap-16 font-mono text-sm">
              <div className="flex flex-col gap-3">
                <span className="font-bold text-text-primary mb-2">Product</span>
                <a href="#features" className="text-text-secondary hover:text-accent-teal transition-colors">Features</a>
                <a href="#how-it-works" className="text-text-secondary hover:text-accent-teal transition-colors">How it Works</a>
              </div>
            </div>
          </div>
          <div className="h-[1px] w-full bg-[#2D2D2D] mb-6" />
          <div className="flex flex-col sm:flex-row items-center justify-between font-mono text-xs text-[#555]">
            <span>© 2026 inko. all rights reserved.</span>
            <span>// built with care for learners</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
