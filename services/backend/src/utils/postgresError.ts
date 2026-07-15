/**
 * True for any Postgres unique_violation (SQLSTATE 23505) on any table/index.
 * Callers that need to know *which* index fired must disambiguate separately
 * (e.g. by re-querying). postgres-js surfaces the SQLSTATE code on the thrown
 * error; duck-typed since the driver doesn't export a class.
 */
export function isUniqueViolation(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "23505"
    );
}
