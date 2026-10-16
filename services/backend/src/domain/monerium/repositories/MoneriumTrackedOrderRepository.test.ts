import { describe, expect, it, vi } from "vitest";
import { firstQuery } from "../../../../test/mock/queryLog";
import { MoneriumTrackedOrderRepository } from "./MoneriumTrackedOrderRepository";

const { queries } = vi.hoisted(() => ({
    queries: [] as { sql: string; params: unknown[] }[],
}));
const claimArgs = {
    now: new Date("2026-10-15T12:00:00Z"),
    limit: 50,
    tiers: [{ maxAgeMs: 3_600_000, recheckMs: 120_000 }],
};

vi.mock("@backend-infrastructure", async () =>
    (await import("../../../../test/mock/queryLog")).infrastructureWithQueryLog(
        queries
    )
);

describe("MoneriumTrackedOrderRepository.claimInFlightDue", () => {
    const repository = new MoneriumTrackedOrderRepository();

    it("claims in one UPDATE that skips locked rows", async () => {
        const { sql } = await firstQuery(queries, () =>
            repository.claimInFlightDue(claimArgs)
        );

        expect(sql).toMatch(
            /^update "monerium_tracked_orders" set "last_checked_at"/
        );
        expect(sql).toContain("skip locked");
        expect(sql).toContain("returning");
        expect(sql).toContain('"state" in (');
    });

    it("only claims orders of wallets whose connection is usable", async () => {
        const { sql, params } = await firstQuery(queries, () =>
            repository.claimInFlightDue(claimArgs)
        );

        expect(sql).toMatch(
            /exists \(select "wallet" from "monerium_connections" where \("monerium_connections"\."wallet" = "monerium_tracked_orders"\."wallet" and "monerium_connections"\."status" = \$\d+\)\)/
        );
        expect(params).toContain("connected");
    });
});

describe("MoneriumTrackedOrderRepository.deleteStale", () => {
    it("deletes settled orders after 7 days and any order after 30 days", async () => {
        const { sql, params } = await firstQuery(queries, () =>
            new MoneriumTrackedOrderRepository().deleteStale(
                new Date("2026-10-15T12:00:00Z")
            )
        );
        expect(sql).toMatch(/^delete from "monerium_tracked_orders" where/);
        expect(sql).toContain('"state" in (');
        expect(params).toEqual(
            expect.arrayContaining([
                "processed",
                "rejected",
                "2026-10-08T12:00:00.000Z",
                "2026-09-15T12:00:00.000Z",
            ])
        );
    });
});
