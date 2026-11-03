import { sql as fragment, type SQL } from "drizzle-orm";
import { type PgColumn, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { moneriumConnectionsTable as table } from "../db/schema";
import { dueWithBackoff, oldestCheckFirst } from "./dueTiers";

const dialect = new PgDialect();
const NOW = new Date("2026-10-15T12:00:00Z");

function render(
    tiers: { maxAgeMs: number; recheckMs: number }[],
    started:
        | SQL
        | PgColumn = fragment`coalesce(${table.profileStateChangedAt}, ${table.createdAt})`
) {
    return dialect.sqlToQuery(
        dueWithBackoff({
            started,
            checkedAt: table.stateCheckedAt,
            tiers,
            now: NOW,
        })
    );
}

describe("dueWithBackoff", () => {
    it("builds one age window per tier, each with its own recheck interval", () => {
        const { params } = render([
            { maxAgeMs: 24 * 3_600_000, recheckMs: 600_000 },
            { maxAgeMs: 7 * 24 * 3_600_000, recheckMs: 3_600_000 },
            { maxAgeMs: 30 * 24 * 3_600_000, recheckMs: 6 * 3_600_000 },
        ]);
        expect(params).toEqual(
            expect.arrayContaining([
                "2026-10-14T12:00:00.000Z",
                "2026-10-08T12:00:00.000Z",
                "2026-09-15T12:00:00.000Z",
                "2026-10-15T11:50:00.000Z",
                "2026-10-15T11:00:00.000Z",
                "2026-10-15T06:00:00.000Z",
            ])
        );
    });

    it("takes a bare column as the start", () => {
        const { sql } = render(
            [{ maxAgeMs: 60_000, recheckMs: 10_000 }],
            table.createdAt
        );
        expect(sql).toContain('"monerium_connections"."created_at" >');
        expect(sql).not.toContain("coalesce(");
    });

    it("never matches without tiers", () => {
        expect(render([]).sql).toBe("false");
    });
});

describe("oldestCheckFirst", () => {
    it("sorts never-checked rows first", () => {
        expect(
            dialect.sqlToQuery(oldestCheckFirst(table.stateCheckedAt)).sql
        ).toBe('"monerium_connections"."state_checked_at" asc nulls first');
    });
});
