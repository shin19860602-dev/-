export const EXPECTED_PROJECT_REF = "idtxondhhnexphqzviry";

export type ConnectionCheck = "missing" | "invalid" | "matches_candidate" | "different_target" | "unrecognized";

// Never return the URL, username, password, query parameters or parser errors.
export function checkDatabaseTarget(value: string | undefined): ConnectionCheck {
  if (!value) return "missing";
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return "invalid";
    if (!url.hostname || !url.username) return "invalid";
    if (url.hostname === `db.${EXPECTED_PROJECT_REF}.supabase.co`) return "matches_candidate";
    if (/^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname)) return "different_target";
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      const username = decodeURIComponent(url.username);
      if (username === `postgres.${EXPECTED_PROJECT_REF}`) return "matches_candidate";
      if (/^postgres\.[a-z0-9]+$/.test(username)) return "different_target";
    }
    return "unrecognized";
  } catch {
    return "invalid";
  }
}
