import { mutation } from "./_generated/server";
import { v } from "convex/values";

const STARTER_WORDS = [
  { target: "勉強", reading: "べんきょう", romanization: "benkyou", meaning: "study; learning", example: "毎日日本語を勉強しています。" },
  { target: "学校", reading: "がっこう", romanization: "gakkou", meaning: "school", example: "学校へ行きます。" },
  { target: "先生", reading: "せんせい", romanization: "sensei", meaning: "teacher", example: "先生は親切です。" },
  { target: "友達", reading: "ともだち", romanization: "tomodachi", meaning: "friend", example: "友達と話しました。" },
  { target: "日本語", reading: "にほんご", romanization: "nihongo", meaning: "Japanese language", example: "日本語を話せますか。" },
  { target: "今日", reading: "きょう", romanization: "kyou", meaning: "today", example: "今日は忙しいです。" },
  { target: "明日", reading: "あした", romanization: "ashita", meaning: "tomorrow", example: "明日会いましょう。" },
  { target: "昨日", reading: "きのう", romanization: "kinou", meaning: "yesterday", example: "昨日映画を見ました。" },
  { target: "時間", reading: "じかん", romanization: "jikan", meaning: "time", example: "時間がありますか。" },
  { target: "電車", reading: "でんしゃ", romanization: "densha", meaning: "train", example: "電車で行きます。" },
  { target: "駅", reading: "えき", romanization: "eki", meaning: "station", example: "駅はどこですか。" },
  { target: "食べる", reading: "たべる", romanization: "taberu", meaning: "to eat", example: "寿司を食べる。" },
  { target: "飲む", reading: "のむ", romanization: "nomu", meaning: "to drink", example: "水を飲みます。" },
  { target: "見る", reading: "みる", romanization: "miru", meaning: "to see", example: "テレビを見る。" },
  { target: "聞く", reading: "きく", romanization: "kiku", meaning: "to listen; ask", example: "音楽を聞きます。" },
  { target: "書く", reading: "かく", romanization: "kaku", meaning: "to write", example: "名前を書く。" },
  { target: "読む", reading: "よむ", romanization: "yomu", meaning: "to read", example: "本を読む。" },
  { target: "行く", reading: "いく", romanization: "iku", meaning: "to go", example: "図書館へ行く。" },
  { target: "来る", reading: "くる", romanization: "kuru", meaning: "to come", example: "友達が来る。" },
  { target: "帰る", reading: "かえる", romanization: "kaeru", meaning: "to return", example: "家に帰る。" },
];

export const seedStarterData = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase();

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      const userId = await ctx.db.insert("users", { email, createdAt: Date.now() });
      user = await ctx.db.get(userId);
    }

    if (!user) {
      throw new Error("Could not create user during seed");
    }

    const userDecks = await ctx.db
      .query("decks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let deck = userDecks.find((d) => d.name === "Core N5" && d.language === "ja");
    if (!deck) {
      const deckId = await ctx.db.insert("decks", {
        userId: user._id,
        name: "Core N5",
        language: "ja",
        archived: false,
        createdAt: Date.now(),
      });
      deck = await ctx.db.get(deckId);
    }

    if (!deck) {
      throw new Error("Could not create deck during seed");
    }

    const existingWords = await ctx.db
      .query("words")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingTargets = new Set(existingWords.map((w) => w.target));
    const deckLinks = await ctx.db
      .query("deck_words")
      .withIndex("by_deck", (q) => q.eq("deckId", deck._id))
      .collect();

    let position = deckLinks.length;
    let inserted = 0;

    for (const word of STARTER_WORDS) {
      if (existingTargets.has(word.target)) {
        continue;
      }

      const wordId = await ctx.db.insert("words", {
        userId: user._id,
        language: "ja",
        target: word.target,
        reading: word.reading,
        romanization: word.romanization,
        meaning: word.meaning,
        example: word.example,
        tags: ["starter", "n5"],
        createdAt: Date.now(),
      });

      await ctx.db.insert("deck_words", {
        deckId: deck._id,
        wordId,
        position,
        snapshotReady: true,
        language: deck.language,
        target: word.target,
        reading: word.reading,
        romanization: word.romanization,
        meaning: word.meaning,
        example: word.example,
        shapeStrength: 50,
        typingStrength: 50,
        listeningStrength: 50,
        shapeDueAt: Date.now(),
        typingDueAt: Date.now(),
        listeningDueAt: Date.now(),
      });

      await ctx.db.insert("practice_queue_entries", {
        deckId: deck._id,
        userId: user._id,
        wordId,
        position,
        language: deck.language,
        target: word.target,
        reading: word.reading,
        romanization: word.romanization,
        meaning: word.meaning,
        example: word.example,
        audioUrl: undefined,
        shapeStrength: 50,
        typingStrength: 50,
        listeningStrength: 50,
        shapeDueAt: Date.now(),
        typingDueAt: Date.now(),
        listeningDueAt: Date.now(),
        weakestStrength: 50,
        nextDueAt: Date.now(),
        updatedAt: Date.now(),
      });

      position += 1;
      inserted += 1;
    }

    return {
      userId: user._id,
      deckId: deck._id,
      inserted,
      totalStarterWords: STARTER_WORDS.length,
    };
  },
});
