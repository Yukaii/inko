import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

type SimulatorCard = {
  target: string;
  reading: string;
  meaning: string;
  answer: string;
  language: "ja" | "en";
};

const MOCK_CARDS: SimulatorCard[] = [
  {
    target: "心",
    reading: "こころ",
    meaning: "heart / spirit",
    answer: "kokoro",
    language: "ja",
  },
  {
    target: "学び",
    reading: "まなび",
    meaning: "learning / study",
    answer: "manabi",
    language: "ja",
  },
  {
    target: "冒険",
    reading: "ぼうけん",
    meaning: "adventure",
    answer: "bouken",
    language: "ja",
  },
  {
    target: "記憶",
    reading: "きおく",
    meaning: "memory / recall",
    answer: "kioku",
    language: "ja",
  },
];

export function PracticeSimulator() {
  const { t } = useTranslation();
  const [cardIndex, setCardIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [streak, setStreak] = useState(0);
  
  const card = MOCK_CARDS[cardIndex];
  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTransitioning) return;

    let charIndex = 0;
    const typeNextChar = () => {
      if (charIndex < card.answer.length) {
        setTyped(card.answer.slice(0, charIndex + 1));
        charIndex++;
        // Add some variation to typing speed
        const delay = 100 + Math.random() * 150;
        typingTimerRef.current = window.setTimeout(typeNextChar, delay);
      } else {
        // Success state
        setStreak(s => s + 1);
        typingTimerRef.current = window.setTimeout(() => {
          nextCard();
        }, 1000);
      }
    };

    typingTimerRef.current = window.setTimeout(typeNextChar, 500);

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [cardIndex, isTransitioning]);

  const nextCard = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCardIndex((prev) => (prev + 1) % MOCK_CARDS.length);
      setTyped("");
      setIsTransitioning(false);
    }, 400);
  };

  const progress = (typed.length / card.answer.length) * 100;

  return (
    <div className="relative flex h-[400px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-[#1a1a1a] bg-bg-page shadow-2xl md:h-[500px]">
      {/* Top Bar Simulator */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4 opacity-60">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-text-secondary/20 px-3 py-1 text-[10px] font-mono text-text-secondary">
            {t("landing.simulator.badge")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-text-secondary/20 px-3 py-1 text-xs text-accent-orange font-display">
            🔥 {streak}
          </span>
        </div>
        <div className="text-[10px] font-mono text-text-secondary">{t("landing.simulator.auto_play")}</div>
      </div>

      <AnimatePresence mode="wait">
        {!isTransitioning && (
          <motion.div
            key={cardIndex}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -10 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-4 px-6 text-center"
          >
            <div className="text-sm tracking-wide text-text-secondary font-mono">
              {card.meaning}
            </div>
            
            <div className="font-jp text-6xl font-bold text-text-primary md:text-8xl">
              {card.target}
            </div>

            <div className="text-lg text-text-secondary font-jp">
              {card.reading}
            </div>

            <div className="mt-4 flex min-h-[42px] justify-center gap-0.5 font-mono text-2xl tracking-widest md:text-4xl">
              {card.answer.split("").map((char, i) => {
                const isTyped = i < typed.length;
                const isCursor = i === typed.length;
                
                return (
                  <span
                    key={i}
                    className={
                      isTyped
                        ? "text-accent-teal"
                        : isCursor
                        ? "text-text-primary underline decoration-accent-orange underline-offset-8 decoration-2"
                        : "text-text-secondary opacity-30"
                    }
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-bg-elevated">
        <motion.div
          className="h-full bg-gradient-to-r from-accent-orange to-accent-teal"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      {/* Interactive Overlay Hint */}
      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <div className="rounded-full bg-bg-elevated/50 px-4 py-1.5 text-[10px] font-mono text-text-secondary backdrop-blur-sm border border-text-secondary/10">
          {t("landing.simulator.hint")}
        </div>
      </div>
    </div>
  );
}
