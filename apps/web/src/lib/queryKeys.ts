export const AUTH_QUERY_ROOTS = [
  "dashboard",
  "me",
  "decks",
  "words-page",
  "practice-session",
  "community-submissions",
] as const;

export function authQueryKey(token: string | null | undefined, ...parts: Array<string | number | null | undefined>) {
  return ["auth", token ?? null, ...parts] as const;
}

export function isAuthScopedQueryKey(queryKey: readonly unknown[]) {
  if (queryKey[0] !== "auth") {
    return false;
  }

  const root = queryKey[2];
  return typeof root === "string" && (AUTH_QUERY_ROOTS as readonly string[]).includes(root);
}
