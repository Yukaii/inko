/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as community from "../community.js";
import type * as dashboard from "../dashboard.js";
import type * as decks from "../decks.js";
import type * as http from "../http.js";
import type * as practice from "../practice.js";
import type * as practiceQueue from "../practiceQueue.js";
import type * as seed from "../seed.js";
import type * as tts from "../tts.js";
import type * as ttsNode from "../ttsNode.js";
import type * as users from "../users.js";
import type * as words from "../words.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  community: typeof community;
  dashboard: typeof dashboard;
  decks: typeof decks;
  http: typeof http;
  practice: typeof practice;
  practiceQueue: typeof practiceQueue;
  seed: typeof seed;
  tts: typeof tts;
  ttsNode: typeof ttsNode;
  users: typeof users;
  words: typeof words;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
