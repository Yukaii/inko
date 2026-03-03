import { Kysely, sql } from "kysely";
import type { Database } from "../types";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("display_name", "text")
    .addColumn("theme_mode", "text")
    .addColumn("typing_mode", "text")
    .addColumn("tts_enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("themes", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("decks")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("language", "text", (col) => col.notNull())
    .addColumn("archived", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("tts_enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("tts_voice", "text", (col) => col.notNull())
    .addColumn("tts_rate", "text", (col) => col.notNull().defaultTo("default"))
    .addColumn("word_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("words")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("language", "text", (col) => col.notNull())
    .addColumn("target", "text", (col) => col.notNull())
    .addColumn("reading", "text")
    .addColumn("romanization", "text")
    .addColumn("meaning", "text", (col) => col.notNull())
    .addColumn("example", "text")
    .addColumn("audio_url", "text")
    .addColumn("tags", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("deck_words")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("deck_id", "text", (col) => col.notNull().references("decks.id").onDelete("cascade"))
    .addColumn("word_id", "text", (col) => col.notNull().references("words.id").onDelete("cascade"))
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .addUniqueConstraint("deck_words_deck_id_word_id_unique", ["deck_id", "word_id"])
    .addUniqueConstraint("deck_words_deck_id_position_unique", ["deck_id", "position"])
    .execute();

  await db.schema
    .createTable("word_channel_stats")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("word_id", "text", (col) => col.notNull().references("words.id").onDelete("cascade"))
    .addColumn("shape_strength", "double precision", (col) => col.notNull())
    .addColumn("typing_strength", "double precision", (col) => col.notNull())
    .addColumn("listening_strength", "double precision", (col) => col.notNull())
    .addColumn("shape_due_at", "bigint", (col) => col.notNull())
    .addColumn("typing_due_at", "bigint", (col) => col.notNull())
    .addColumn("listening_due_at", "bigint", (col) => col.notNull())
    .addColumn("last_practiced_at", "bigint")
    .addUniqueConstraint("word_channel_stats_user_id_word_id_unique", ["user_id", "word_id"])
    .execute();

  await db.schema
    .createTable("practice_sessions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("deck_id", "text", (col) => col.notNull().references("decks.id").onDelete("cascade"))
    .addColumn("started_at", "bigint", (col) => col.notNull())
    .addColumn("finished_at", "bigint")
    .addColumn("cards_completed", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("attempted_word_ids", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .execute();

  await db.schema
    .createTable("practice_attempts")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("session_id", "text", (col) => col.notNull().references("practice_sessions.id").onDelete("cascade"))
    .addColumn("word_id", "text", (col) => col.notNull().references("words.id").onDelete("cascade"))
    .addColumn("shape_score", "double precision", (col) => col.notNull())
    .addColumn("typing_score", "double precision", (col) => col.notNull())
    .addColumn("listening_score", "double precision", (col) => col.notNull())
    .addColumn("typing_ms", "integer", (col) => col.notNull())
    .addColumn("submitted_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("daily_stats")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("date", "text", (col) => col.notNull())
    .addColumn("words_completed", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("seconds_spent", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("streak_count", "integer", (col) => col.notNull().defaultTo(0))
    .addUniqueConstraint("daily_stats_user_id_date_unique", ["user_id", "date"])
    .execute();

  await db.schema
    .createTable("community_deck_submissions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("submitter_user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("submitter_email", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("summary", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("language", "text", (col) => col.notNull())
    .addColumn("difficulty", "text", (col) => col.notNull())
    .addColumn("source_kind", "text", (col) => col.notNull())
    .addColumn("source_name", "text", (col) => col.notNull())
    .addColumn("card_count", "integer", (col) => col.notNull())
    .addColumn("tags", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("note_types", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("words", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("moderation_notes", "text")
    .addColumn("reviewed_by_user_id", "text", (col) => col.references("users.id").onDelete("set null"))
    .addColumn("reviewed_at", "bigint")
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .addColumn("updated_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("community_decks")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("slug", "text", (col) => col.notNull().unique())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("summary", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("language", "text", (col) => col.notNull())
    .addColumn("difficulty", "text", (col) => col.notNull())
    .addColumn("author_name", "text", (col) => col.notNull())
    .addColumn("source_submission_id", "text", (col) => col.references("community_deck_submissions.id").onDelete("set null"))
    .addColumn("published_by_user_id", "text", (col) => col.references("users.id").onDelete("set null"))
    .addColumn("downloads", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("rating", "double precision", (col) => col.notNull().defaultTo(0))
    .addColumn("rating_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("card_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("tags", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("note_types", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("words", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("published_at", "bigint", (col) => col.notNull())
    .addColumn("updated_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("community_deck_comments")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("deck_id", "text", (col) => col.notNull().references("community_decks.id").onDelete("cascade"))
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("author_name", "text", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .addColumn("updated_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("community_deck_ratings")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("deck_id", "text", (col) => col.notNull().references("community_decks.id").onDelete("cascade"))
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("rating", "integer", (col) => col.notNull())
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .addColumn("updated_at", "bigint", (col) => col.notNull())
    .addUniqueConstraint("community_deck_ratings_deck_id_user_id_unique", ["deck_id", "user_id"])
    .execute();

  await db.schema.createIndex("decks_user_id_idx").on("decks").column("user_id").execute();
  await db.schema.createIndex("words_user_id_idx").on("words").column("user_id").execute();
  await db.schema.createIndex("deck_words_deck_id_position_idx").on("deck_words").columns(["deck_id", "position"]).execute();
  await db.schema.createIndex("word_channel_stats_user_id_idx").on("word_channel_stats").column("user_id").execute();
  await db.schema.createIndex("practice_sessions_user_id_idx").on("practice_sessions").column("user_id").execute();
  await db.schema.createIndex("practice_attempts_session_id_idx").on("practice_attempts").column("session_id").execute();
  await db.schema.createIndex("daily_stats_user_id_idx").on("daily_stats").column("user_id").execute();
  await db.schema.createIndex("community_decks_language_idx").on("community_decks").column("language").execute();
  await db.schema.createIndex("community_decks_updated_at_idx").on("community_decks").column("updated_at").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("community_deck_ratings").ifExists().execute();
  await db.schema.dropTable("community_deck_comments").ifExists().execute();
  await db.schema.dropTable("community_decks").ifExists().execute();
  await db.schema.dropTable("community_deck_submissions").ifExists().execute();
  await db.schema.dropTable("daily_stats").ifExists().execute();
  await db.schema.dropTable("practice_attempts").ifExists().execute();
  await db.schema.dropTable("practice_sessions").ifExists().execute();
  await db.schema.dropTable("word_channel_stats").ifExists().execute();
  await db.schema.dropTable("deck_words").ifExists().execute();
  await db.schema.dropTable("words").ifExists().execute();
  await db.schema.dropTable("decks").ifExists().execute();
  await db.schema.dropTable("users").ifExists().execute();
}
