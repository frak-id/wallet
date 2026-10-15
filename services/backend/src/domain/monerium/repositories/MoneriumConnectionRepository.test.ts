import { describe, expect, it, vi } from "vitest";
import { MoneriumConnectionRepository } from "./MoneriumConnectionRepository";

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

const NOW = new Date("2026-10-15T12:00:00Z");
const claim = {
    now: NOW,
    limit: 50,
    tiers: [
        { maxAgeMs: 60_000, recheckMs: 10_000 },
        { maxAgeMs: 600_000, recheckMs: 30_000 },
    ],
};

async function captured(run: () => Promise<unknown>) {
    queries.length = 0;
    await run().catch(() => undefined);
    return queries[0]?.sql ?? "";
}

describe("MoneriumConnectionRepository claims", () => {
    const repository = new MoneriumConnectionRepository();

    it("claims profile rows in one UPDATE that skips rows locked by another pod, never-checked first", async () => {
        const sql = await captured(() =>
            repository.claimDueForProfileSync(claim)
        );
        expect(sql).toMatch(
            /^update "monerium_connections" set "state_checked_at"/
        );
        expect(sql).toContain("skip locked");
        expect(sql).toContain("returning");
        expect(sql).toContain("limit $");
        expect(sql).toMatch(/"state_checked_at" asc nulls first/);
        expect(sql).toContain("coalesce(");
        expect(sql).toContain('"profile_state_changed_at"');
    });

    it("bounds the link poll by the time the link entered pending", async () => {
        const sql = await captured(() => repository.claimDueForLinkSync(claim));
        expect(sql).toContain('"wallet_link_pending_at"');
        expect(sql).toContain('"wallet_link_state" = $');
        expect(sql).toMatch(/asc nulls first/);
    });

    it("resets the profile age on connect", async () => {
        const sql = await captured(() =>
            repository.upsertConnected({
                wallet: "0x00000000000000000000000000000000000000aa",
                moneriumUserId: null,
                accessTokenEncrypted: "a",
                accessTokenExpiresAt: NOW,
                refreshTokenEncrypted: "r",
                clearSiweFailure: true,
            })
        );
        expect(sql).toContain('"profile_state_changed_at"');
        expect(sql.match(/"profile_state_changed_at"/g)?.length).toBe(2);
    });
});
