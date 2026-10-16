import { drizzle } from "drizzle-orm/postgres-js";

export type LoggedQuery = { sql: string; params: unknown[] };

/** Replaces `@backend-infrastructure` with a drizzle `db` that logs every statement into `queries`. */
export function infrastructureWithQueryLog(queries: LoggedQuery[]) {
    return {
        db: drizzle.mock({
            logger: {
                logQuery: (sql: string, params: unknown[]) => {
                    queries.push({ sql, params });
                },
            },
        }),
    };
}

/** The first statement `run` sends; the mocked driver then fails, which is swallowed. */
export async function firstQuery(
    queries: LoggedQuery[],
    run: () => Promise<unknown>
): Promise<LoggedQuery> {
    queries.length = 0;
    await run().catch(() => undefined);
    return queries[0] ?? { sql: "", params: [] };
}
