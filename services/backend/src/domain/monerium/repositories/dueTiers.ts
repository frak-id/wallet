import { and, isNull, lt, or, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/** Rows younger than `maxAgeMs` (and older than the previous tier) are rechecked every `recheckMs`. */
export type RecheckTier = { maxAgeMs: number; recheckMs: number };

function at(date: Date): SQL {
    return sql`${date.toISOString()}::timestamp`;
}

/**
 * Due when the last check is older than the recheck of the tier the age since `started`
 * falls in. Rows older than the last tier, or with a null `started`, are never due.
 */
export function dueWithBackoff(params: {
    started: SQL | PgColumn;
    checkedAt: PgColumn;
    tiers: readonly RecheckTier[];
    now: Date;
}): SQL {
    const { started } = params;
    const clauses: SQL[] = [];
    let lowerAgeMs = 0;
    for (const tier of params.tiers) {
        const notChecked = or(
            isNull(params.checkedAt),
            lt(
                params.checkedAt,
                new Date(params.now.getTime() - tier.recheckMs)
            )
        );
        const youngerThan = sql`${started} > ${at(new Date(params.now.getTime() - tier.maxAgeMs))}`;
        const olderThan =
            lowerAgeMs === 0
                ? undefined
                : sql`${started} <= ${at(new Date(params.now.getTime() - lowerAgeMs))}`;
        const clause = and(youngerThan, olderThan, notChecked);
        if (clause) clauses.push(clause);
        lowerAgeMs = tier.maxAgeMs;
    }
    return or(...clauses) ?? sql`false`;
}

/** Postgres sorts NULL last on ASC, which would starve rows that were never checked. */
export function oldestCheckFirst(column: PgColumn): SQL {
    return sql`${column} asc nulls first`;
}
