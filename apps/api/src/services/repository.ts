import { randomUUID } from "node:crypto";
import {
  DefaultThemes,
  PRACTICE_SESSION_CARD_CAP_DEFAULT,
  applyAttempt,
  defaultWordChannelStats,
  getDefaultEdgeTtsVoice,
  nextDueAt,
  scoreListening,
  scoreShape,
  scoreTyping,
  type CommunityDeckCommentDTO,
  type CommunityDeckDetailDTO,
  type CommunityDeckSummaryDTO,
  type CommunityDeckSubmissionDTO,
  type CommunitySubmissionStatus,
  type CreateCommunityDeckCommentInput,
  type CreateCommunityDeckSubmissionInput,
  type CreateDeckInput,
  type CreateWordInput,
  type CreateWordsBatchInput,
  type DeleteWordsBatchInput,
  type LanguageCode,
  type PracticeCardDTO,
  type RateCommunityDeckInput,
  type ReviewCommunityDeckSubmissionInput,
  type StartPracticeSessionInput,
  type SubmitPracticeCardInput,
  type ThemeConfig,
  type TypingMode,
  type UpdateDeckInput,
  type UpdatePreferencesInput,
  type UpdateProfileInput,
  type UpdateWordInput,
} from "@inko/shared";
import { sql, type Selectable } from "kysely";
import { getDb } from "../db/client";
import type {
  CommunityDeckCommentsTable,
  CommunityDeckRatingsTable,
  CommunityDeckSubmissionsTable,
  CommunityDecksTable,
  DeckWordsTable,
  DecksTable,
  UsersTable,
  WordChannelStatsTable,
  WordsTable,
} from "../db/types";
import { tracePractice } from "../lib/diagnostics";
import { env } from "../lib/env";
import { buildImportedAudioObjectKey, putObject } from "../lib/object-storage";

const db = getDb();
const BATCH_WORDS_CHUNK_SIZE = 200;

export const PERFORMANCE_CONSTANTS = {
  CONVEX_ARRAY_ARG_LIMIT: 8192,
  BATCH_WORDS_CHUNK_SIZE,
  PRACTICE_SESSION_BUFFER_SIZE: Math.max(0, PRACTICE_SESSION_CARD_CAP_DEFAULT - 1),
  PRACTICE_TTS_PREFETCH_WINDOW: 7,
};

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export const testChunkArray = chunkArray;

export class RepositoryError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

type UserRow = Selectable<UsersTable>;
type DeckRow = Selectable<DecksTable>;
type WordRow = Selectable<WordsTable>;
type DeckWordRow = Selectable<DeckWordsTable>;
type WordStatsRow = Selectable<WordChannelStatsTable>;
type CommunityDeckRow = Selectable<CommunityDecksTable>;
type CommunityCommentRow = Selectable<CommunityDeckCommentsTable>;
type CommunityRatingRow = Selectable<CommunityDeckRatingsTable>;
type CommunitySubmissionRow = Selectable<CommunityDeckSubmissionsTable>;

const moderatorEmails = new Set(
  env.MODERATOR_EMAILS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function canModerateCommunity(user: Pick<UserRow, "email">) {
  return moderatorEmails.has(user.email.toLowerCase());
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function asArray<T>(value: unknown, fallback: T): T {
  return (value as T | undefined) ?? fallback;
}

function jsonb<T>(value: T) {
  return sql<T>`CAST(${JSON.stringify(value)} AS jsonb)`;
}

function toUserDTO(user: UserRow) {
  const fallbackName = (user.email.split("@")[0] ?? "learner").replace(/[._-]+/g, " ").trim() || "learner";
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name ?? fallbackName.slice(0, 60),
    themeMode: user.theme_mode ?? "dark",
    typingMode: user.typing_mode ?? "language_specific",
    ttsEnabled: user.tts_enabled ?? true,
    canModerateCommunity: canModerateCommunity(user),
    themes: asArray<ThemeConfig>(user.themes, DefaultThemes),
    createdAt: asNumber(user.created_at),
  };
}

function toDeckDTO(deck: DeckRow) {
  return {
    id: deck.id,
    userId: deck.user_id,
    name: deck.name,
    language: deck.language,
    archived: deck.archived,
    ttsEnabled: deck.tts_enabled,
    ttsVoice: deck.tts_voice ?? getDefaultEdgeTtsVoice(deck.language),
    ttsRate: deck.tts_rate ?? "default",
    createdAt: asNumber(deck.created_at),
  };
}

function toWordDTO(word: WordRow) {
  return {
    id: word.id,
    userId: word.user_id,
    language: word.language,
    target: word.target,
    reading: word.reading ?? undefined,
    romanization: word.romanization ?? undefined,
    meaning: word.meaning,
    example: word.example ?? undefined,
    audioUrl: word.audio_url ?? undefined,
    tags: asArray<string[]>(word.tags, []),
  };
}

function toCommunityDeckSummaryDTO(deck: CommunityDeckRow): CommunityDeckSummaryDTO {
  return {
    id: deck.id,
    slug: deck.slug,
    title: deck.title,
    summary: deck.summary,
    language: deck.language,
    difficulty: deck.difficulty,
    authorName: deck.author_name,
    downloads: deck.downloads,
    rating: deck.rating,
    ratingCount: deck.rating_count,
    cardCount: deck.card_count,
    updatedAt: asNumber(deck.updated_at),
    tags: asArray<string[]>(deck.tags, []),
  };
}

function toCommunityCommentDTO(comment: CommunityCommentRow): CommunityDeckCommentDTO {
  return {
    id: comment.id,
    userId: comment.user_id,
    authorName: comment.author_name,
    body: comment.body,
    createdAt: asNumber(comment.created_at),
    updatedAt: asNumber(comment.updated_at),
  };
}

function toCommunitySubmissionDTO(submission: CommunitySubmissionRow): CommunityDeckSubmissionDTO {
  return {
    id: submission.id,
    submitterUserId: submission.submitter_user_id,
    submitterEmail: submission.submitter_email,
    title: submission.title,
    summary: submission.summary,
    description: submission.description,
    language: submission.language,
    difficulty: submission.difficulty,
    sourceKind: submission.source_kind,
    sourceName: submission.source_name,
    cardCount: submission.card_count,
    tags: asArray<string[]>(submission.tags, []),
    noteTypes: asArray<Array<{ name: string; fields: string[] }>>(submission.note_types, []),
    sampleWords: asArray<CreateWordInput[]>(submission.words, []).slice(0, 8),
    status: submission.status,
    moderationNotes: submission.moderation_notes ?? undefined,
    reviewedByUserId: submission.reviewed_by_user_id ?? undefined,
    reviewedAt: submission.reviewed_at == null ? undefined : asNumber(submission.reviewed_at),
    createdAt: asNumber(submission.created_at),
    updatedAt: asNumber(submission.updated_at),
  };
}

function decodeCursor(cursor: string | null) {
  if (!cursor) return -1;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function todayString(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function yesterdayString(now = Date.now()) {
  return new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function mapWordInput(word: CreateWordInput) {
  return {
    target: word.target,
    reading: word.reading ?? null,
    romanization: word.romanization ?? null,
    meaning: word.meaning,
    example: word.example ?? null,
    audio_url: word.audioUrl ?? null,
    tags: word.tags ?? [],
  };
}

async function requireUser(userId: string) {
  const user = await db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst();
  if (!user) throw new RepositoryError("User not found", 404);
  return user;
}

async function requireModerator(userId: string) {
  const user = await requireUser(userId);
  if (!canModerateCommunity(user)) {
    throw new RepositoryError("Forbidden", 403);
  }
  return user;
}

async function requireDeckOwnedByUser(userId: string, deckId: string) {
  const deck = await db.selectFrom("decks").selectAll().where("id", "=", deckId).executeTakeFirst();
  if (!deck) throw new RepositoryError("Deck not found", 404);
  if (deck.user_id !== userId) throw new RepositoryError("Forbidden", 403);
  return deck;
}

async function requireWordOwnedByUser(userId: string, wordId: string) {
  const word = await db.selectFrom("words").selectAll().where("id", "=", wordId).executeTakeFirst();
  if (!word) throw new RepositoryError("Word not found", 404);
  if (word.user_id !== userId) throw new RepositoryError("Forbidden", 403);
  return word;
}

async function getWordStats(userId: string, wordId: string) {
  return await db
    .selectFrom("word_channel_stats")
    .selectAll()
    .where("user_id", "=", userId)
    .where("word_id", "=", wordId)
    .executeTakeFirst();
}

async function selectPracticeCards(userId: string, deckId: string, excludeWordIds: string[], limit: number) {
  const now = Date.now();
  let query = db
    .selectFrom("deck_words as dw")
    .innerJoin("words as w", "w.id", "dw.word_id")
    .leftJoin("word_channel_stats as stats", (join) =>
      join.onRef("stats.word_id", "=", "w.id").on("stats.user_id", "=", userId),
    )
    .select([
      "dw.deck_id as deckId",
      "w.id as wordId",
      "w.language as language",
      "w.target as target",
      "w.reading as reading",
      "w.romanization as romanization",
      "w.meaning as meaning",
      "w.example as example",
      "w.audio_url as audioUrl",
      "dw.position as position",
    ])
    .where("dw.deck_id", "=", deckId);

  if (excludeWordIds.length > 0) {
    query = query.where("w.id", "not in", excludeWordIds);
  }

  const rows = await query
    .orderBy(sql<number>`least(coalesce(stats.shape_due_at, ${now}), coalesce(stats.typing_due_at, ${now}), coalesce(stats.listening_due_at, ${now}))`)
    .orderBy(sql<number>`least(coalesce(stats.shape_strength, 0), coalesce(stats.typing_strength, 0), coalesce(stats.listening_strength, 0))`)
    .orderBy("dw.position asc")
    .limit(limit)
    .execute();

  return rows.map((row) => ({
    wordId: row.wordId,
    deckId: row.deckId,
    language: row.language,
    target: row.target,
    reading: row.reading ?? undefined,
    romanization: row.romanization ?? undefined,
    meaning: row.meaning,
    example: row.example ?? undefined,
    audioUrl: row.audioUrl ?? undefined,
  })) satisfies PracticeCardDTO[];
}

async function getCommunityDeckDetail(deck: CommunityDeckRow, viewerUserId?: string): Promise<CommunityDeckDetailDTO> {
  const [comments, viewerRating] = await Promise.all([
    db
      .selectFrom("community_deck_comments")
      .selectAll()
      .where("deck_id", "=", deck.id)
      .orderBy("created_at asc")
      .execute(),
    viewerUserId
      ? db
          .selectFrom("community_deck_ratings")
          .select("rating")
          .where("deck_id", "=", deck.id)
          .where("user_id", "=", viewerUserId)
          .executeTakeFirst()
      : Promise.resolve(undefined),
  ]);

  return {
    ...toCommunityDeckSummaryDTO(deck),
    description: deck.description,
    noteTypes: asArray<Array<{ name: string; fields: string[] }>>(deck.note_types, []),
    words: asArray<CreateWordInput[]>(deck.words, []),
    viewerRating: viewerRating?.rating,
    comments: comments.map(toCommunityCommentDTO),
  };
}

async function recalculateCommunityDeckRating(deckId: string) {
  const aggregate = await db
    .selectFrom("community_deck_ratings")
    .select((eb) => [
      eb.fn.avg<number>("rating").as("avg_rating"),
      eb.fn.count<number>("id").as("rating_count"),
    ])
    .where("deck_id", "=", deckId)
    .executeTakeFirstOrThrow();

  const updated = await db
    .updateTable("community_decks")
    .set({
      rating: Number(aggregate.avg_rating ?? 0),
      rating_count: Number(aggregate.rating_count ?? 0),
      updated_at: Date.now(),
    })
    .where("id", "=", deckId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return updated;
}

export const repository = {
  async getOrCreateUser(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.selectFrom("users").selectAll().where("email", "=", normalizedEmail).executeTakeFirst();
    if (existing) return toUserDTO(existing);

    const created = await db
      .insertInto("users")
      .values({
        id: randomUUID(),
        email: normalizedEmail,
        display_name: null,
        theme_mode: "dark",
        typing_mode: "language_specific",
        tts_enabled: true,
        themes: jsonb(DefaultThemes),
        created_at: Date.now(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toUserDTO(created);
  },

  async getUserById(userId: string) {
    const user = await db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst();
    return user ? toUserDTO(user) : null;
  },

  async updateUserProfile(userId: string, input: UpdateProfileInput) {
    await requireUser(userId);
    const user = await db
      .updateTable("users")
      .set({
        display_name: input.displayName,
        theme_mode: input.themeMode,
        typing_mode: input.typingMode,
        tts_enabled: input.ttsEnabled,
        themes: jsonb(input.themes),
      })
      .where("id", "=", userId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toUserDTO(user);
  },

  async updateUserPreferences(userId: string, input: UpdatePreferencesInput) {
    await requireUser(userId);
    const user = await db
      .updateTable("users")
      .set({ tts_enabled: input.ttsEnabled })
      .where("id", "=", userId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toUserDTO(user);
  },

  async listDecks(userId: string) {
    const decks = await db
      .selectFrom("decks")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at desc")
      .execute();
    return decks.map(toDeckDTO);
  },

  async createDeck(userId: string, input: CreateDeckInput) {
    await requireUser(userId);
    const deck = await db
      .insertInto("decks")
      .values({
        id: randomUUID(),
        user_id: userId,
        name: input.name,
        language: input.language,
        archived: false,
        tts_enabled: true,
        tts_voice: getDefaultEdgeTtsVoice(input.language),
        tts_rate: "default",
        word_count: 0,
        created_at: Date.now(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDeckDTO(deck);
  },

  async updateDeck(userId: string, deckId: string, input: UpdateDeckInput) {
    const existingDeck = await requireDeckOwnedByUser(userId, deckId);
    const language = input.language ?? existingDeck.language;
    const updatedDeck = await db
      .updateTable("decks")
      .set({
        name: input.name ?? existingDeck.name,
        language,
        archived: input.archived ?? existingDeck.archived,
        tts_enabled: input.ttsEnabled ?? existingDeck.tts_enabled,
        tts_voice: input.ttsVoice ?? existingDeck.tts_voice ?? getDefaultEdgeTtsVoice(language),
        tts_rate: input.ttsRate ?? existingDeck.tts_rate,
      })
      .where("id", "=", deckId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDeckDTO(updatedDeck);
  },

  async listDeckWordsPage(userId: string, deckId: string, cursor: string | null, limit: number) {
    const deck = await requireDeckOwnedByUser(userId, deckId);
    const safeLimit = Math.max(1, Math.min(500, limit));
    const positionCursor = decodeCursor(cursor);

    const rows = await db
      .selectFrom("deck_words as dw")
      .innerJoin("words as w", "w.id", "dw.word_id")
      .select(["dw.position as position", "w.id", "w.user_id", "w.language", "w.target", "w.reading", "w.romanization", "w.meaning", "w.example", "w.audio_url", "w.tags"])
      .where("dw.deck_id", "=", deckId)
      .where("dw.position", ">", positionCursor)
      .orderBy("dw.position asc")
      .limit(safeLimit + 1)
      .execute();

    const page = rows.slice(0, safeLimit);
    const last = page.at(-1);

    return {
      words: page.map((row) =>
        toWordDTO({
          id: row.id,
          user_id: row.user_id,
          language: row.language,
          target: row.target,
          reading: row.reading,
          romanization: row.romanization,
          meaning: row.meaning,
          example: row.example,
          audio_url: row.audio_url,
          tags: row.tags,
          created_at: Date.now(),
        }),
      ),
      nextCursor: rows.length > safeLimit && last ? String(last.position) : null,
      isDone: rows.length <= safeLimit,
      totalCount: deck.word_count,
    };
  },

  async createWord(userId: string, deckId: string, input: CreateWordInput) {
    const deck = await requireDeckOwnedByUser(userId, deckId);
    const now = Date.now();
    const created = await db.transaction().execute(async (trx) => {
      const maxPositionRow = await trx
        .selectFrom("deck_words")
        .select((eb) => eb.fn.max<number>("position").as("max_position"))
        .where("deck_id", "=", deckId)
        .executeTakeFirst();
      const position = (maxPositionRow?.max_position ?? -1) + 1;
      const wordId = randomUUID();

      const word = await trx
        .insertInto("words")
        .values({
          id: wordId,
          user_id: userId,
          language: deck.language,
          target: input.target,
          reading: input.reading ?? null,
          romanization: input.romanization ?? null,
          meaning: input.meaning,
          example: input.example ?? null,
          audio_url: input.audioUrl ?? null,
          tags: jsonb(input.tags ?? []),
          created_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx.insertInto("deck_words").values({
        id: randomUUID(),
        deck_id: deckId,
        word_id: wordId,
        position,
        created_at: now,
      }).execute();

      await trx.updateTable("decks").set({ word_count: deck.word_count + 1 }).where("id", "=", deckId).execute();
      return word;
    });

    return toWordDTO(created);
  },

  async createWordsBatch(userId: string, deckId: string, input: CreateWordsBatchInput) {
    const deck = await requireDeckOwnedByUser(userId, deckId);
    const createdWords: ReturnType<typeof toWordDTO>[] = [];

    for (const wordsChunk of chunkArray(input.words, BATCH_WORDS_CHUNK_SIZE)) {
      const now = Date.now();
      const chunkCreated = await db.transaction().execute(async (trx) => {
        const maxPositionRow = await trx
          .selectFrom("deck_words")
          .select((eb) => eb.fn.max<number>("position").as("max_position"))
          .where("deck_id", "=", deckId)
          .executeTakeFirst();
        let position = (maxPositionRow?.max_position ?? -1) + 1;
        const rows: WordRow[] = [];

        for (const word of wordsChunk) {
          const inserted = await trx
            .insertInto("words")
            .values({
              id: randomUUID(),
              user_id: userId,
              language: deck.language,
              target: word.target,
              reading: word.reading ?? null,
              romanization: word.romanization ?? null,
              meaning: word.meaning,
              example: word.example ?? null,
              audio_url: word.audioUrl ?? null,
              tags: jsonb(word.tags ?? []),
              created_at: now,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

          rows.push(inserted);
          await trx.insertInto("deck_words").values({
            id: randomUUID(),
            deck_id: deckId,
            word_id: inserted.id,
            position,
            created_at: now,
          }).execute();
          position += 1;
        }

        await trx
          .updateTable("decks")
          .set({ word_count: deck.word_count + rows.length })
          .where("id", "=", deckId)
          .execute();

        return rows;
      });

      createdWords.push(...chunkCreated.map(toWordDTO));
    }

    return createdWords;
  },

  async storeImportedAudio(userId: string, input: { filename: string; contentType: string; bytes: Uint8Array }) {
    await requireUser(userId);
    const key = buildImportedAudioObjectKey(userId, input.filename);
    const audioUrl = await putObject({
      key,
      body: input.bytes,
      contentType: input.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    });
    return { audioUrl };
  },

  async updateWord(userId: string, wordId: string, input: UpdateWordInput) {
    await requireWordOwnedByUser(userId, wordId);
    const word = await db
      .updateTable("words")
      .set({
        target: input.target,
        reading: input.reading ?? null,
        romanization: input.romanization ?? null,
        meaning: input.meaning,
        example: input.example ?? null,
        audio_url: input.audioUrl ?? null,
        tags: jsonb(input.tags ?? []),
      })
      .where("id", "=", wordId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toWordDTO(word);
  },

  async getWordById(userId: string, wordId: string) {
    return toWordDTO(await requireWordOwnedByUser(userId, wordId));
  },

  async deleteWord(userId: string, wordId: string) {
    await requireWordOwnedByUser(userId, wordId);

    await db.transaction().execute(async (trx) => {
      const links = await trx.selectFrom("deck_words").select(["deck_id"]).where("word_id", "=", wordId).execute();
      await trx.deleteFrom("deck_words").where("word_id", "=", wordId).execute();
      await trx.deleteFrom("word_channel_stats").where("word_id", "=", wordId).execute();
      await trx.deleteFrom("practice_attempts").where("word_id", "=", wordId).execute();
      await trx.deleteFrom("words").where("id", "=", wordId).execute();

      for (const link of links) {
        const count = await trx
          .selectFrom("deck_words")
          .select((eb) => eb.fn.count<number>("id").as("count"))
          .where("deck_id", "=", link.deck_id)
          .executeTakeFirstOrThrow();
        await trx.updateTable("decks").set({ word_count: Number(count.count) }).where("id", "=", link.deck_id).execute();
      }
    });

    return { ok: true };
  },

  async deleteWordsBatch(userId: string, deckId: string, input: DeleteWordsBatchInput) {
    await requireDeckOwnedByUser(userId, deckId);
    let deleted = 0;
    const failedWordIds: string[] = [];

    for (const wordId of input.wordIds) {
      const inDeck = await db
        .selectFrom("deck_words as dw")
        .innerJoin("words as w", "w.id", "dw.word_id")
        .select("w.id")
        .where("dw.deck_id", "=", deckId)
        .where("w.id", "=", wordId)
        .where("w.user_id", "=", userId)
        .executeTakeFirst();

      if (!inDeck) {
        failedWordIds.push(wordId);
        continue;
      }

      await this.deleteWord(userId, wordId);
      deleted += 1;
    }

    return { deleted, failedWordIds };
  },

  async deleteDeck(userId: string, deckId: string) {
    await requireDeckOwnedByUser(userId, deckId);

    await db.transaction().execute(async (trx) => {
      const words = await trx
        .selectFrom("deck_words")
        .select("word_id")
        .where("deck_id", "=", deckId)
        .execute();

      await trx.deleteFrom("practice_sessions").where("deck_id", "=", deckId).execute();
      await trx.deleteFrom("deck_words").where("deck_id", "=", deckId).execute();
      await trx.deleteFrom("decks").where("id", "=", deckId).execute();

      for (const { word_id } of words) {
        const remainingLinkCount = await trx
          .selectFrom("deck_words")
          .select((eb) => eb.fn.count<number>("id").as("count"))
          .where("word_id", "=", word_id)
          .executeTakeFirstOrThrow();

        if (Number(remainingLinkCount.count) === 0) {
          await trx.deleteFrom("word_channel_stats").where("word_id", "=", word_id).execute();
          await trx.deleteFrom("practice_attempts").where("word_id", "=", word_id).execute();
          await trx.deleteFrom("words").where("id", "=", word_id).execute();
        }
      }
    });

    return { ok: true };
  },

  async listPublishedCommunityDecks(options?: { language?: LanguageCode; search?: string }) {
    let query = db.selectFrom("community_decks").selectAll();
    if (options?.language) {
      query = query.where("language", "=", options.language);
    }
    if (options?.search?.trim()) {
      const search = `%${options.search.trim().toLowerCase()}%`;
      query = query.where((eb) =>
        eb.or([
          sql<boolean>`lower(title) like ${search}`,
          sql<boolean>`lower(summary) like ${search}`,
          sql<boolean>`lower(description) like ${search}`,
        ]),
      );
    }
    const decks = await query.orderBy("updated_at desc").execute();
    return decks.map(toCommunityDeckSummaryDTO);
  },

  async getPublishedCommunityDeckBySlug(slug: string, viewerUserId?: string) {
    const deck = await db.selectFrom("community_decks").selectAll().where("slug", "=", slug).executeTakeFirst();
    if (!deck) throw new RepositoryError("Community deck not found", 404);
    return await getCommunityDeckDetail(deck, viewerUserId);
  },

  async rateCommunityDeck(userId: string, slug: string, input: RateCommunityDeckInput) {
    await requireUser(userId);
    const deck = await db.selectFrom("community_decks").selectAll().where("slug", "=", slug).executeTakeFirst();
    if (!deck) throw new RepositoryError("Community deck not found", 404);
    const now = Date.now();

    await db
      .insertInto("community_deck_ratings")
      .values({
        id: randomUUID(),
        deck_id: deck.id,
        user_id: userId,
        rating: input.rating,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["deck_id", "user_id"]).doUpdateSet({
          rating: input.rating,
          updated_at: now,
        }),
      )
      .execute();

    const updatedDeck = await recalculateCommunityDeckRating(deck.id);
    return await getCommunityDeckDetail(updatedDeck, userId);
  },

  async addCommunityDeckComment(userId: string, slug: string, input: CreateCommunityDeckCommentInput) {
    const deck = await db.selectFrom("community_decks").selectAll().where("slug", "=", slug).executeTakeFirst();
    if (!deck) throw new RepositoryError("Community deck not found", 404);
    const user = await requireUser(userId);
    const fallbackName = (user.email.split("@")[0] ?? "learner").replace(/[._-]+/g, " ").trim() || "learner";
    const now = Date.now();

    await db.insertInto("community_deck_comments").values({
      id: randomUUID(),
      deck_id: deck.id,
      user_id: userId,
      author_name: user.display_name ?? fallbackName.slice(0, 60),
      body: input.body.trim(),
      created_at: now,
      updated_at: now,
    }).execute();

    return await getCommunityDeckDetail(deck, userId);
  },

  async deleteCommunityDeckComment(userId: string, slug: string, commentId: string) {
    const deck = await db.selectFrom("community_decks").selectAll().where("slug", "=", slug).executeTakeFirst();
    if (!deck) throw new RepositoryError("Community deck not found", 404);
    const user = await requireUser(userId);
    const comment = await db
      .selectFrom("community_deck_comments")
      .selectAll()
      .where("id", "=", commentId)
      .where("deck_id", "=", deck.id)
      .executeTakeFirst();

    if (!comment) throw new RepositoryError("Community comment not found", 404);
    if (comment.user_id !== userId && !canModerateCommunity(user)) {
      throw new RepositoryError("Forbidden", 403);
    }

    await db.deleteFrom("community_deck_comments").where("id", "=", commentId).execute();
    return await getCommunityDeckDetail(deck, userId);
  },

  async createCommunityDeckSubmission(userId: string, input: CreateCommunityDeckSubmissionInput) {
    const user = await requireUser(userId);
    const now = Date.now();
    const submission = await db
      .insertInto("community_deck_submissions")
      .values({
        id: randomUUID(),
        submitter_user_id: userId,
        submitter_email: user.email,
        title: input.title,
        summary: input.summary,
        description: input.description,
        language: input.language,
        difficulty: input.difficulty,
        source_kind: input.sourceKind,
        source_name: input.sourceName,
        card_count: input.words.length,
        tags: jsonb(input.tags ?? []),
        note_types: jsonb(input.noteTypes ?? []),
        words: jsonb(input.words.map((word) => ({ ...word, tags: word.tags ?? [] }))),
        status: "pending",
        moderation_notes: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toCommunitySubmissionDTO(submission);
  },

  async listMyCommunityDeckSubmissions(userId: string) {
    const submissions = await db
      .selectFrom("community_deck_submissions")
      .selectAll()
      .where("submitter_user_id", "=", userId)
      .orderBy("created_at desc")
      .execute();
    return submissions.map(toCommunitySubmissionDTO);
  },

  async deleteMyCommunityDeckSubmission(userId: string, submissionId: string) {
    const submission = await db
      .selectFrom("community_deck_submissions")
      .selectAll()
      .where("id", "=", submissionId)
      .executeTakeFirst();

    if (!submission) throw new RepositoryError("Community submission not found", 404);
    if (submission.submitter_user_id !== userId) throw new RepositoryError("Forbidden", 403);
    if (submission.status === "approved") {
      throw new RepositoryError("Approved submissions cannot be discarded", 409);
    }

    await db.deleteFrom("community_deck_submissions").where("id", "=", submissionId).execute();
    return { ok: true };
  },

  async listCommunityDeckSubmissions(userId: string, status?: CommunitySubmissionStatus) {
    await requireModerator(userId);
    let query = db.selectFrom("community_deck_submissions").selectAll();
    if (status) {
      query = query.where("status", "=", status);
    }
    const submissions = await query.orderBy("created_at desc").execute();
    return submissions.map(toCommunitySubmissionDTO);
  },

  async reviewCommunityDeckSubmission(userId: string, submissionId: string, input: ReviewCommunityDeckSubmissionInput) {
    await requireModerator(userId);
    const submission = await db
      .selectFrom("community_deck_submissions")
      .selectAll()
      .where("id", "=", submissionId)
      .executeTakeFirst();
    if (!submission) throw new RepositoryError("Community submission not found", 404);

    const now = Date.now();
    const nextSlug = input.slug?.trim() || slugify(submission.title);

    const reviewed = await db.transaction().execute(async (trx) => {
      const updatedSubmission = await trx
        .updateTable("community_deck_submissions")
        .set({
          status: input.status,
          moderation_notes: input.moderationNotes ?? null,
          reviewed_by_user_id: userId,
          reviewed_at: now,
          updated_at: now,
        })
        .where("id", "=", submissionId)
        .returningAll()
        .executeTakeFirstOrThrow();

      if (input.status === "approved") {
        const conflicting = await trx
          .selectFrom("community_decks")
          .select(["id", "source_submission_id"])
          .where("slug", "=", nextSlug)
          .executeTakeFirst();
        if (conflicting && conflicting.source_submission_id !== submissionId) {
          throw new RepositoryError("Community deck slug already exists", 409);
        }

        const existingDeck = await trx
          .selectFrom("community_decks")
          .selectAll()
          .where("source_submission_id", "=", submissionId)
          .executeTakeFirst();

        if (existingDeck) {
          await trx
            .updateTable("community_decks")
            .set({
              slug: nextSlug,
              title: submission.title,
              summary: submission.summary,
              description: submission.description,
              language: submission.language,
              difficulty: submission.difficulty,
              author_name: submission.submitter_email,
              published_by_user_id: userId,
              card_count: submission.card_count,
              tags: jsonb(asArray(submission.tags, [])),
              note_types: jsonb(asArray(submission.note_types, [])),
              words: jsonb(asArray(submission.words, [])),
              updated_at: now,
            })
            .where("id", "=", existingDeck.id)
            .execute();
        } else {
          await trx.insertInto("community_decks").values({
            id: randomUUID(),
            slug: nextSlug,
            title: submission.title,
            summary: submission.summary,
            description: submission.description,
            language: submission.language,
            difficulty: submission.difficulty,
            author_name: submission.submitter_email,
            source_submission_id: submissionId,
            published_by_user_id: userId,
            downloads: 0,
            rating: 0,
            rating_count: 0,
            card_count: submission.card_count,
            tags: jsonb(asArray(submission.tags, [])),
            note_types: jsonb(asArray(submission.note_types, [])),
            words: jsonb(asArray(submission.words, [])),
            published_at: now,
            updated_at: now,
          }).execute();
        }
      } else {
        await trx
          .deleteFrom("community_decks")
          .where("source_submission_id", "=", submissionId)
          .execute();
      }

      return updatedSubmission;
    });

    return toCommunitySubmissionDTO(reviewed);
  },

  async startPracticeSession(userId: string, input: StartPracticeSessionInput) {
    const overallStartedAt = Date.now();
    const deck = await requireDeckOwnedByUser(userId, input.deckId);
    const user = await requireUser(userId);
    const cards = await selectPracticeCards(userId, input.deckId, [], PERFORMANCE_CONSTANTS.PRACTICE_SESSION_BUFFER_SIZE + 1);
    const firstCard = cards[0];
    if (!firstCard) {
      throw new RepositoryError("No words available in deck", 409);
    }

    const session = await db
      .insertInto("practice_sessions")
      .values({
        id: randomUUID(),
        user_id: userId,
        deck_id: input.deckId,
        started_at: Date.now(),
        finished_at: null,
        cards_completed: 0,
        attempted_word_ids: jsonb([]),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    tracePractice({
      event: "session_start",
      userId,
      deckId: input.deckId,
      durationMs: Date.now() - overallStartedAt,
      totalMs: Date.now() - overallStartedAt,
      returnedNextCard: firstCard.wordId,
    });

    return {
      sessionId: session.id,
      card: firstCard,
      upcomingCards: cards.slice(1),
      typingMode: user.typing_mode ?? "language_specific",
      ttsEnabled: deck.tts_enabled,
      ttsVoice: deck.tts_voice,
      ttsRate: deck.tts_rate,
      sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      cardsCompleted: session.cards_completed,
      remainingCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
    };
  },

  async submitPracticeCard(userId: string, sessionId: string, wordId: string, input: SubmitPracticeCardInput) {
    const overallStartedAt = Date.now();
    if (!input.handwritingCompleted || !input.audioPlayed) {
      return {
        accepted: false,
        scores: { shape: 0, typing: 0, listening: 0 },
        nextDueAt: new Date().toISOString(),
        sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      };
    }

    const session = await db.selectFrom("practice_sessions").selectAll().where("id", "=", sessionId).executeTakeFirst();
    if (!session) throw new RepositoryError("Session not found", 404);
    if (session.user_id !== userId) throw new RepositoryError("Forbidden", 403);

    const word = await requireWordOwnedByUser(userId, wordId);
    const inDeck = await db
      .selectFrom("deck_words")
      .select("id")
      .where("deck_id", "=", session.deck_id)
      .where("word_id", "=", wordId)
      .executeTakeFirst();
    if (!inDeck) throw new RepositoryError("Word not in session deck", 403);

    const user = await requireUser(userId);
    const shape = scoreShape(input.handwritingCompleted);
    const typing = scoreTyping(
      input.typingInput,
      word.target,
      word.reading ?? undefined,
      word.romanization ?? undefined,
      input.typingMs,
      word.language,
      user.typing_mode ?? "language_specific",
    );
    const listening = scoreListening(input.listeningConfidence);

    if (typing === 0) {
      return {
        accepted: false,
        scores: { shape, typing, listening },
        nextDueAt: new Date().toISOString(),
        sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
        cardsCompleted: session.cards_completed,
        remainingCards: Math.max(0, PRACTICE_SESSION_CARD_CAP_DEFAULT - session.cards_completed),
      };
    }

    const existing = await getWordStats(userId, wordId);
    const now = Date.now();
    const current = existing
      ? {
          shape: { strength: existing.shape_strength, dueAt: existing.shape_due_at as number },
          typing: { strength: existing.typing_strength, dueAt: existing.typing_due_at as number },
          listening: { strength: existing.listening_strength, dueAt: existing.listening_due_at as number },
        }
      : defaultWordChannelStats(now);
    const next = applyAttempt(current, { shape, typing, listening }, now);

    if (session.cards_completed >= PRACTICE_SESSION_CARD_CAP_DEFAULT) {
      return {
        accepted: false,
        scores: { shape, typing, listening },
        nextDueAt: new Date(nextDueAt(next)).toISOString(),
        nextCard: null,
        sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
        cardsCompleted: session.cards_completed,
        remainingCards: 0,
        sessionCapped: true,
      };
    }

    const attemptedWordIds = [...new Set([...(session.attempted_word_ids as string[]), wordId])];
    const updatedSession = await db.transaction().execute(async (trx) => {
      await trx.insertInto("practice_attempts").values({
        id: randomUUID(),
        session_id: sessionId,
        word_id: wordId,
        shape_score: shape,
        typing_score: typing,
        listening_score: listening,
        typing_ms: input.typingMs,
        submitted_at: now,
      }).execute();

      await trx
        .insertInto("word_channel_stats")
        .values({
          id: randomUUID(),
          user_id: userId,
          word_id: wordId,
          shape_strength: next.shape.strength,
          typing_strength: next.typing.strength,
          listening_strength: next.listening.strength,
          shape_due_at: next.shape.dueAt,
          typing_due_at: next.typing.dueAt,
          listening_due_at: next.listening.dueAt,
          last_practiced_at: now,
        })
        .onConflict((oc) =>
          oc.columns(["user_id", "word_id"]).doUpdateSet({
            shape_strength: next.shape.strength,
            typing_strength: next.typing.strength,
            listening_strength: next.listening.strength,
            shape_due_at: next.shape.dueAt,
            typing_due_at: next.typing.dueAt,
            listening_due_at: next.listening.dueAt,
            last_practiced_at: now,
          }),
        )
        .execute();

      return await trx
        .updateTable("practice_sessions")
        .set({
          cards_completed: session.cards_completed + 1,
          attempted_word_ids: jsonb(attemptedWordIds),
        })
        .where("id", "=", sessionId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });

    const cardsCompleted = updatedSession.cards_completed;
    const remainingCards = Math.max(0, PRACTICE_SESSION_CARD_CAP_DEFAULT - cardsCompleted);
    const nextCards = remainingCards > 0
      ? await selectPracticeCards(userId, session.deck_id, attemptedWordIds, PERFORMANCE_CONSTANTS.PRACTICE_TTS_PREFETCH_WINDOW + 1)
      : [];
    const nextCard = nextCards[0] ?? null;

    tracePractice({
      event: "submit_practice_card",
      userId,
      sessionId,
      deckId: session.deck_id,
      wordId,
      durationMs: Date.now() - overallStartedAt,
      totalMs: Date.now() - overallStartedAt,
      returnedNextCard: nextCard?.wordId ?? null,
      attemptedWordIds: attemptedWordIds.length,
      sessionCapped: remainingCards === 0,
    });

    return {
      accepted: true,
      scores: { shape, typing, listening },
      nextDueAt: new Date(nextDueAt(next)).toISOString(),
      nextCard,
      upcomingCards: nextCards.slice(1),
      sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      cardsCompleted,
      remainingCards,
      sessionCapped: remainingCards === 0,
    };
  },

  async finishPracticeSession(userId: string, sessionId: string) {
    const existingSession = await db.selectFrom("practice_sessions").selectAll().where("id", "=", sessionId).executeTakeFirst();
    if (!existingSession) throw new RepositoryError("Session not found", 404);
    if (existingSession.user_id !== userId) throw new RepositoryError("Forbidden", 403);

    const finishedAt = existingSession.finished_at ?? Date.now();
    const session = await db
      .updateTable("practice_sessions")
      .set({ finished_at: finishedAt })
      .where("id", "=", sessionId)
      .returningAll()
      .executeTakeFirstOrThrow();

    const attempts = await db
      .selectFrom("practice_attempts")
      .select(["shape_score", "typing_score", "listening_score", "submitted_at"])
      .where("session_id", "=", sessionId)
      .execute();

    const count = attempts.length;
    const avg = (key: "shape_score" | "typing_score" | "listening_score") =>
      count === 0 ? 0 : Math.round(attempts.reduce((acc, item) => acc + item[key], 0) / count);
    const durationSeconds = Math.max(0, Math.round((finishedAt - (session.started_at as number)) / 1000));
    const date = todayString(finishedAt);

    const previousDay = await db
      .selectFrom("daily_stats")
      .select(["streak_count"])
      .where("user_id", "=", userId)
      .where("date", "=", yesterdayString(finishedAt))
      .executeTakeFirst();
    const existingDay = await db
      .selectFrom("daily_stats")
      .selectAll()
      .where("user_id", "=", userId)
      .where("date", "=", date)
      .executeTakeFirst();
    const streakCount = existingDay?.streak_count ?? (previousDay?.streak_count ? previousDay.streak_count + 1 : 1);

    await db
      .insertInto("daily_stats")
      .values({
        id: randomUUID(),
        user_id: userId,
        date,
        words_completed: session.cards_completed,
        seconds_spent: durationSeconds,
        streak_count: streakCount,
      })
      .onConflict((oc) =>
        oc.columns(["user_id", "date"]).doUpdateSet({
          words_completed: sql`daily_stats.words_completed + ${session.cards_completed}`,
          seconds_spent: sql`daily_stats.seconds_spent + ${durationSeconds}`,
          streak_count: streakCount,
        }),
      )
      .execute();

    return {
      sessionId,
      cardsCompleted: session.cards_completed,
      avgShapeScore: avg("shape_score"),
      avgTypingScore: avg("typing_score"),
      avgListeningScore: avg("listening_score"),
      durationSeconds,
    };
  },

  async getPracticeSessionDetails(userId: string, sessionId: string) {
    const session = await db.selectFrom("practice_sessions").selectAll().where("id", "=", sessionId).executeTakeFirst();
    if (!session) throw new RepositoryError("Session not found", 404);
    if (session.user_id !== userId) throw new RepositoryError("Forbidden", 403);

    const [deck, attempts] = await Promise.all([
      db.selectFrom("decks").select(["name", "language"]).where("id", "=", session.deck_id).executeTakeFirst(),
      db
        .selectFrom("practice_attempts as pa")
        .innerJoin("words as w", "w.id", "pa.word_id")
        .select([
          "pa.id as attemptId",
          "pa.word_id as wordId",
          "pa.shape_score as shapeScore",
          "pa.typing_score as typingScore",
          "pa.listening_score as listeningScore",
          "pa.typing_ms as typingMs",
          "pa.submitted_at as submittedAt",
          "w.target as target",
          "w.meaning as meaning",
          "w.reading as reading",
          "w.romanization as romanization",
        ])
        .where("pa.session_id", "=", sessionId)
        .orderBy("pa.submitted_at asc")
        .execute(),
    ]);

    const durationSeconds = Math.max(0, Math.round((((session.finished_at as number | null) ?? Date.now()) - (session.started_at as number)) / 1000));
    const count = attempts.length;
    const avg = (key: "shapeScore" | "typingScore" | "listeningScore") =>
      count === 0 ? 0 : Math.round(attempts.reduce((acc, item) => acc + item[key], 0) / count);

    return {
      sessionId: session.id,
      deckId: session.deck_id,
      deckName: deck?.name ?? null,
      language: deck?.language ?? null,
      startedAt: session.started_at as number,
      finishedAt: (session.finished_at as number | null) ?? null,
      cardsCompleted: session.cards_completed,
      durationSeconds,
      avgShapeScore: avg("shapeScore"),
      avgTypingScore: avg("typingScore"),
      avgListeningScore: avg("listeningScore"),
      attempts: attempts.map((attempt) => ({
        attemptId: attempt.attemptId,
        wordId: attempt.wordId,
        target: attempt.target,
        meaning: attempt.meaning,
        reading: attempt.reading ?? undefined,
        romanization: attempt.romanization ?? undefined,
        shapeScore: attempt.shapeScore,
        typingScore: attempt.typingScore,
        listeningScore: attempt.listeningScore,
        typingMs: attempt.typingMs,
        submittedAt: attempt.submittedAt as number,
      })),
    };
  },

  async dashboardSummary(userId: string) {
    return await this.dashboardStats(userId);
  },

  async dashboardStats(userId: string) {
    const now = Date.now();
    const today = todayString(now);
    const [learned, dueToday, daily, recentSessions] = await Promise.all([
      db
        .selectFrom("word_channel_stats")
        .select((eb) => eb.fn.count<number>("id").as("count"))
        .where("user_id", "=", userId)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("word_channel_stats")
        .select((eb) => eb.fn.count<number>("id").as("count"))
        .where("user_id", "=", userId)
        .where(sql<boolean>`least(shape_due_at, typing_due_at, listening_due_at) <= ${now}`)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("daily_stats")
        .selectAll()
        .where("user_id", "=", userId)
        .where("date", "=", today)
        .executeTakeFirst(),
      this.dashboardRecentSessions(userId),
    ]);

    return {
      totalWordsLearned: Number(learned.count ?? 0),
      wordsDueToday: Number(dueToday.count ?? 0),
      learningStreak: daily?.streak_count ?? 0,
      sessionTimeSeconds: daily?.seconds_spent ?? 0,
      recentSessions,
    };
  },

  async dashboardRecentSessions(userId: string) {
    const recentSessions = await db
      .selectFrom("practice_sessions as ps")
      .leftJoin("decks as d", "d.id", "ps.deck_id")
      .select([
        "ps.id as sessionId",
        "ps.deck_id as deckId",
        "d.name as deckName",
        "ps.cards_completed as cardsCompleted",
        "ps.started_at as startedAt",
        "ps.finished_at as finishedAt",
      ])
      .where("ps.user_id", "=", userId)
      .orderBy("ps.started_at desc")
      .limit(10)
      .execute();

    return {
      recentSessions: recentSessions.map((session) => ({
        sessionId: session.sessionId,
        deckId: session.deckId,
        deckName: session.deckName ?? undefined,
        cardsCompleted: asNumber(session.cardsCompleted),
        startedAt: asNumber(session.startedAt),
        finishedAt: session.finishedAt == null ? undefined : asNumber(session.finishedAt),
      })),
    };
  },
};

export type Repository = typeof repository;
