import { describe, expect, it, vi } from "vitest";
import { MoneriumTrackedOrderRepository } from "./MoneriumTrackedOrderRepository";

const { queries } = vi.hoisted(() => ({
    queries: [] as { sql: string; params: unknown[] }[],
}));

vi.mock("@backend-infrastructure", async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    return {
        db: drizzle.mock({
            logger: {
                logQuery: (sql: string, params: unknown[]) => {
                    queries.push({ sql, params });
                },
            },
        }),
    };
});

describe("MoneriumTrackedOrderRepository.claimInFlightDue", () => {
    it("claims in one UPDATE that skips locked rows and serves never-checked orders first", async () => {
        queries.length = 0;
        await new MoneriumTrackedOrderRepository()
            .claimInFlightDue({
                now: new Date("2026-10-15T12:00:00Z"),
                limit: 50,
                tiers: [{ maxAgeMs: 3_600_000, recheckMs: 120_000 }],
            })
            .catch(() => undefined);

        const sql = queries[0]?.sql ?? "";
        expect(sql).toMatch(
            /^update "monerium_tracked_orders" set "last_checked_at"/
        );
        expect(sql).toContain("skip locked");
        expect(sql).toContain("returning");
        expect(sql).toMatch(/"last_checked_at" asc nulls first/);
        expect(sql).toContain('"state" in (');
    });
});
