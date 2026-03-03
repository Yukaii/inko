import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "./env";

type StoredObject = {
  body: Buffer;
  contentType: string;
  contentLength: number | null;
};

function requireStorageConfig() {
  if (
    !env.OBJECT_STORAGE_ENDPOINT ||
    !env.OBJECT_STORAGE_ACCESS_KEY_ID ||
    !env.OBJECT_STORAGE_SECRET_ACCESS_KEY ||
    !env.OBJECT_STORAGE_BUCKET
  ) {
    throw new Error("Object storage is not configured");
  }
}

let client: S3Client | null = null;

function getClient() {
  requireStorageConfig();
  if (client) return client;
  client = new S3Client({
    region: env.OBJECT_STORAGE_REGION,
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
}

function normalizeExtension(filename: string) {
  const extension = extname(filename).toLowerCase();
  return extension && extension.length <= 10 ? extension : "";
}

export function buildImportedAudioObjectKey(userId: string, filename: string) {
  const stem = sanitizeFileSegment(filename.replace(/\.[^.]+$/, ""));
  return `imports/${userId}/${randomUUID()}-${stem}${normalizeExtension(filename)}`;
}

export function buildTtsObjectKey(input: {
  userId: string;
  deckId: string;
  wordId: string;
  voice: string;
  rate: "-20%" | "default" | "+20%";
}) {
  return `tts/${input.userId}/${input.deckId}/${input.wordId}/${sanitizeFileSegment(input.voice)}/${sanitizeFileSegment(input.rate)}.mp3`;
}

export function buildMediaUrl(key: string) {
  const url = new URL("/api/media", env.API_PUBLIC_URL);
  url.searchParams.set("key", key);
  return url.toString();
}

export async function putObject(input: {
  key: string;
  body: Uint8Array | Buffer;
  contentType: string;
  cacheControl?: string;
}) {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.OBJECT_STORAGE_BUCKET!,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
    }),
  );
  return buildMediaUrl(input.key);
}

export async function hasObject(key: string) {
  const s3 = getClient();
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: env.OBJECT_STORAGE_BUCKET!,
        Key: key,
      }),
    );
    return true;
  } catch (error: any) {
    const code = error?.$metadata?.httpStatusCode;
    if (code === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const s3 = getClient();
  try {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: env.OBJECT_STORAGE_BUCKET!,
        Key: key,
      }),
    );
    const body = result.Body;
    if (!body || typeof body.transformToByteArray !== "function") {
      throw new Error("Object storage response body is not readable");
    }
    return {
      body: Buffer.from(await body.transformToByteArray()),
      contentType: result.ContentType ?? "application/octet-stream",
      contentLength: typeof result.ContentLength === "number" ? result.ContentLength : null,
    };
  } catch (error) {
    if (error instanceof NoSuchKey || (error as any)?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}
