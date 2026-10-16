import { describe, expect, it, vi } from "vitest";
import { firstQuery } from "../../../../test/mock/queryLog";
import { MoneriumConnectionRepository } from "./MoneriumConnectionRepository";

const { queries } = vi.hoisted(() => ({
    queries: [] as { sql: string; params: unknown[] }[],
}));

vi.mock("@backend-infrastructure", async () =>
    (await import("../../../../test/mock/queryLog")).infrastructureWithQueryLog(
        queries
    )
);

const NOW = new Date("2026-10-15T12:00:00Z");
const claim = {
    now: NOW,
    limit: 50,
    tiers: [
        { maxAgeMs: 60_000, recheckMs: 10_000 },
        { maxAgeMs: 600_000, recheckMs: 30_000 },
    ],
};

const sqlOf = async (run: () => Promise<unknown>) =>
    (await firstQuery(queries, run)).sql;

describe("MoneriumConnectionRepository claims", () => {
    const repository = new MoneriumConnectionRepository();

    it("claims profile rows in one UPDATE that skips rows locked by another pod, never-checked first", async () => {
        const sql = await sqlOf(() => repository.claimDueForProfileSync(claim));
        expect(sql).toMatch(
            /^update "monerium_connections" set "state_checked_at"/
        );
        expect(sql).toContain("skip locked");
        expect(sql).toContain("returning");
        expect(sql).toContain('"status" = $');
        expect(sql).toContain('"profile_state_changed_at" >');
        expect(sql).not.toContain("coalesce(");
    });

    it("bounds the link poll by the time the link entered pending", async () => {
        const sql = await sqlOf(() => repository.claimDueForLinkSync(claim));
        expect(sql).toMatch(
            /coalesce\("monerium_connections"\."wallet_link_pending_at", "monerium_connections"\."updated_at"\)/
        );
        expect(sql).toContain('"wallet_link_state" = $');
    });

    it("resets the profile age and clears a SIWE failure on connect", async () => {
        const sql = await sqlOf(() =>
            repository.upsertConnected({
                wallet: "0x00000000000000000000000000000000000000aa",
                accessTokenEncrypted: "a",
                accessTokenExpiresAt: NOW,
                refreshTokenEncrypted: "r",
            })
        );
        expect(sql).toContain('"profile_state_changed_at" = $');
        expect(sql).toContain('"siwe_failed_at" = $');
    });
});
