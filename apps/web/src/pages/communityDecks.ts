import type { CreateWordInput, LanguageCode } from "@inko/shared";

export type CommunityDeck = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  language: LanguageCode;
  difficulty: string;
  author: string;
  downloads: number;
  rating: number;
  cardCount: number;
  updatedAt: string;
  tags: string[];
  noteTypes: Array<{
    name: string;
    fields: string[];
  }>;
  words: CreateWordInput[];
};

export const COMMUNITY_DECKS: CommunityDeck[] = [
  {
    slug: "jlpt-n5-verbs-starter",
    title: "JLPT N5 Verbs Starter",
    summary: "A small starter deck for common Japanese verbs with readings, romanization, and usage examples.",
    description:
      "Built for beginners who want tight, production-ready cards instead of noisy scraped vocabulary. The field layout mirrors common Anki note types, so imports stay predictable.",
    language: "ja",
    difficulty: "Beginner",
    author: "Inko Community",
    downloads: 1842,
    rating: 4.8,
    cardCount: 12,
    updatedAt: "2026-02-24",
    tags: ["jlpt", "verbs", "starter", "anki-friendly"],
    noteTypes: [
      { name: "Basic Meaning", fields: ["Expression", "Reading", "Meaning", "Romanization", "Example", "Tags"] },
    ],
    words: [
      { target: "食べる", reading: "たべる", meaning: "to eat", romanization: "taberu", example: "私は寿司を食べる。", tags: ["verb", "n5"] },
      { target: "飲む", reading: "のむ", meaning: "to drink", romanization: "nomu", example: "水を飲む。", tags: ["verb", "n5"] },
      { target: "行く", reading: "いく", meaning: "to go", romanization: "iku", example: "学校へ行く。", tags: ["verb", "n5"] },
      { target: "来る", reading: "くる", meaning: "to come", romanization: "kuru", example: "友達が来る。", tags: ["verb", "n5"] },
      { target: "見る", reading: "みる", meaning: "to see", romanization: "miru", example: "映画を見る。", tags: ["verb", "n5"] },
      { target: "聞く", reading: "きく", meaning: "to listen; to ask", romanization: "kiku", example: "音楽を聞く。", tags: ["verb", "n5"] },
      { target: "読む", reading: "よむ", meaning: "to read", romanization: "yomu", example: "本を読む。", tags: ["verb", "n5"] },
      { target: "書く", reading: "かく", meaning: "to write", romanization: "kaku", example: "名前を書く。", tags: ["verb", "n5"] },
      { target: "話す", reading: "はなす", meaning: "to speak", romanization: "hanasu", example: "日本語を話す。", tags: ["verb", "n5"] },
      { target: "買う", reading: "かう", meaning: "to buy", romanization: "kau", example: "パンを買う。", tags: ["verb", "n5"] },
      { target: "待つ", reading: "まつ", meaning: "to wait", romanization: "matsu", example: "駅で待つ。", tags: ["verb", "n5"] },
      { target: "帰る", reading: "かえる", meaning: "to return home", romanization: "kaeru", example: "家に帰る。", tags: ["verb", "n5"] },
    ],
  },
  {
    slug: "topik-travel-core",
    title: "TOPIK Travel Core",
    summary: "Practical Korean travel vocabulary with polite forms and short context examples.",
    description:
      "A compact Korean deck focused on stations, hotels, food, and essential polite phrases. It is formatted for straightforward field mapping from typical Anki exports.",
    language: "ko",
    difficulty: "Beginner",
    author: "Inko Community",
    downloads: 936,
    rating: 4.6,
    cardCount: 8,
    updatedAt: "2026-02-18",
    tags: ["travel", "topik", "survival", "anki-friendly"],
    noteTypes: [
      { name: "Travel Phrase", fields: ["Expression", "Meaning", "Romanization", "Example", "Tags"] },
    ],
    words: [
      { target: "화장실", meaning: "bathroom", romanization: "hwajangsil", example: "화장실이 어디예요?", tags: ["travel", "core"] },
      { target: "물", meaning: "water", romanization: "mul", example: "물 좀 주세요.", tags: ["travel", "food"] },
      { target: "얼마예요?", meaning: "how much is it?", romanization: "eolmayeyo?", example: "이거 얼마예요?", tags: ["travel", "shopping"] },
      { target: "감사합니다", meaning: "thank you", romanization: "gamsahamnida", example: "도와주셔서 감사합니다.", tags: ["travel", "polite"] },
      { target: "도와주세요", meaning: "please help me", romanization: "dowajuseyo", example: "길을 잃었어요. 도와주세요.", tags: ["travel", "emergency"] },
      { target: "기차역", meaning: "train station", romanization: "gichayeok", example: "기차역은 멀어요?", tags: ["travel", "transport"] },
      { target: "예약", meaning: "reservation", romanization: "yeyak", example: "예약이 있어요.", tags: ["travel", "hotel"] },
      { target: "영수증", meaning: "receipt", romanization: "yeongsujeung", example: "영수증 주세요.", tags: ["travel", "shopping"] },
    ],
  },
  {
    slug: "hsk1-core-nouns",
    title: "HSK 1 Core Nouns",
    summary: "Foundational Mandarin nouns with pinyin, simple examples, and clean meaning fields.",
    description:
      "Designed for quick importing and fast cleanup. The sample cards follow a strict target-reading-meaning structure that maps cleanly into Inko.",
    language: "zh",
    difficulty: "Beginner",
    author: "Inko Community",
    downloads: 1214,
    rating: 4.7,
    cardCount: 8,
    updatedAt: "2026-02-20",
    tags: ["hsk", "nouns", "starter", "anki-friendly"],
    noteTypes: [
      { name: "HSK Basic", fields: ["Hanzi", "Pinyin", "Meaning", "Example", "Tags"] },
    ],
    words: [
      { target: "人", reading: "rén", meaning: "person", example: "这个人是老师。", tags: ["hsk1", "noun"] },
      { target: "水", reading: "shuǐ", meaning: "water", example: "我喝水。", tags: ["hsk1", "noun"] },
      { target: "书", reading: "shū", meaning: "book", example: "这本书很好。", tags: ["hsk1", "noun"] },
      { target: "学校", reading: "xuéxiào", meaning: "school", example: "她在学校。", tags: ["hsk1", "noun"] },
      { target: "朋友", reading: "péngyou", meaning: "friend", example: "他是我的朋友。", tags: ["hsk1", "noun"] },
      { target: "家", reading: "jiā", meaning: "home", example: "我回家。", tags: ["hsk1", "noun"] },
      { target: "老师", reading: "lǎoshī", meaning: "teacher", example: "老师来了。", tags: ["hsk1", "noun"] },
      { target: "名字", reading: "míngzi", meaning: "name", example: "你的名字是什么？", tags: ["hsk1", "noun"] },
    ],
  },
];

export function getCommunityDeck(slug: string | undefined) {
  if (!slug) return undefined;
  return COMMUNITY_DECKS.find((deck) => deck.slug === slug);
}
