const UNIQUE_VIOLATION = "23505";
const MAX_CAUSE_DEPTH = 3;

/**
 * True for any Postgres unique_violation (SQLSTATE 23505) on any table/index.
 * Callers that need to know *which* index fired must disambiguate separately
 * (e.g. by re-querying). Drizzle wraps the driver error in a `DrizzleQueryError`,
 * so the SQLSTATE sits on `cause`, not on the error a repository throws.
 */
export function isUniqueViolation(err: unknown): boolean {
    let current: unknown = err;
    for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
        if (typeof current !== "object" || current === null) return false;
        if ("code" in current && current.code === UNIQUE_VIOLATION) return true;
        current = "cause" in current ? current.cause : null;
    }
    return false;
}
