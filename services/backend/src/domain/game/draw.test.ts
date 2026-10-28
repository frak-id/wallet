import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    CANDIDATE_WINDOW_MS,
    candidateVerifyBy,
    canonicalList,
    DRAND_QUICKNET,
    DRAW_ALGORITHM,
    drandRandomness,
    drandRoundAt,
    drandRoundTime,
    drawCandidatesFor,
    frozenStandingOf,
    pseudonymOf,
    rankCandidates,
    snapshotRoot,
    verifyDrandBeacon,
} from "./draw";

// Quicknet round 33416581, as served by api.drand.sh on 2026-10-26.
const ROUND = 33416581;
const SIGNATURE =
    "8592d3ce0c351457c9e974c046c6c72f597b125a1ac60ab1003419b7246a9bad80704d40cb67b046cfd77be4f5bf619e";
const RANDOMNESS =
    "a3b9b665609d3104fd1f48d077decb4cfdbee39d7a4516c12c4673b4babfc36e";

describe("drand rounds", () => {
    it("maps a time to the first round emitted at or after it", () => {
        const genesis = new Date(DRAND_QUICKNET.genesisTime * 1000);
        expect(drandRoundAt(genesis)).toBe(1);
        expect(drandRoundAt(new Date(genesis.getTime() + 1))).toBe(2);
        expect(drandRoundAt(new Date(genesis.getTime() + 3000))).toBe(2);

        const at = drandRoundTime(ROUND);
        expect(drandRoundAt(at)).toBe(ROUND);
        expect(drandRoundAt(new Date(at.getTime() + 1))).toBe(ROUND + 1);
    });

    it("accepts the genuine beacon and derives drand's randomness", () => {
        expect(verifyDrandBeacon(ROUND, SIGNATURE)).toBe(true);
        expect(drandRandomness(SIGNATURE)).toBe(RANDOMNESS);
    });

    it.each([
        { name: "another round", round: ROUND + 1, signature: SIGNATURE },
        {
            name: "a tampered signature",
            round: ROUND,
            signature: `${SIGNATURE.slice(0, -2)}00`,
        },
        { name: "garbage", round: ROUND, signature: "abcd" },
    ])("rejects $name", ({ round, signature }) => {
        expect(verifyDrandBeacon(round, signature)).toBe(false);
    });
});

describe("snapshot", () => {
    const entries = [
        { pid: "bb", tickets: 3 },
        { pid: "aa", tickets: 1 },
        { pid: "cc", tickets: 0 },
    ];

    it("lists ticket holders sorted by pid, one line each", () => {
        expect(canonicalList(entries)).toBe("aa,1\nbb,3\n");
    });

    it("hashes the published list", () => {
        expect(snapshotRoot(entries)).toBe(
            createHash("sha256").update("aa,1\nbb,3\n").digest("hex")
        );
    });

    it("gives each player a stable pid that depends on the draw's key", () => {
        const pid = pseudonymOf("key-1", "group-1");
        expect(pid).toMatch(/^[0-9a-f]{32}$/);
        expect(pseudonymOf("key-1", "group-1")).toBe(pid);
        expect(pseudonymOf("key-2", "group-1")).not.toBe(pid);
    });
});

describe("rankCandidates", () => {
    const entries = [
        { pid: "a1", tickets: 1 },
        { pid: "b2", tickets: 5 },
        { pid: "c3", tickets: 3 },
        { pid: "d4", tickets: 14 },
    ];
    const rank = (count: number, randomness = RANDOMNESS) =>
        rankCandidates({ randomness, gameId: "game-1", entries, count });

    it("replays the same ranking from the same beacon", () => {
        expect(rank(4)).toEqual(rank(4));
        expect(rank(4)).toMatchInlineSnapshot(`
          [
            "d4",
            "b2",
            "c3",
            "a1",
          ]
        `);
    });

    it("never picks a player twice and stops when everyone is ranked", () => {
        const ranked = rank(10);
        expect(ranked).toHaveLength(4);
        expect(new Set(ranked).size).toBe(4);
    });

    it("does not depend on the order entries are given in", () => {
        const shuffled = rankCandidates({
            randomness: RANDOMNESS,
            gameId: "game-1",
            entries: [...entries].reverse(),
            count: 4,
        });
        expect(shuffled).toEqual(rank(4));
    });

    it("returns nobody when no one holds a ticket", () => {
        expect(
            rankCandidates({
                randomness: RANDOMNESS,
                gameId: "game-1",
                entries: [{ pid: "a1", tickets: 0 }],
                count: 3,
            })
        ).toEqual([]);
    });

    it("picks winners in proportion to their tickets", () => {
        const wins = new Map<string, number>();
        for (let i = 0; i < 2300; i++) {
            const randomness = createHash("sha256")
                .update(String(i))
                .digest("hex");
            const [winner = ""] = rank(1, randomness);
            wins.set(winner, (wins.get(winner) ?? 0) + 1);
        }
        // 23 tickets: a1 1/23, b2 5/23, c3 3/23, d4 14/23 of 2300 draws.
        expect(wins.get("a1")).toBeGreaterThan(60);
        expect(wins.get("a1")).toBeLessThan(150);
        expect(wins.get("d4")).toBeGreaterThan(1300);
        expect(wins.get("d4")).toBeLessThan(1500);
    });
});

describe("drawCandidatesFor", () => {
    it("keeps replaying v1 draws with their 10 candidates", () => {
        expect(drawCandidatesFor("frak-draw-v1")).toBe(10);
        expect(drawCandidatesFor(DRAW_ALGORITHM)).toBe(30);
        expect(drawCandidatesFor("frak-draw-v0")).toBeNull();
    });

    it("draws the same first candidates whatever the count", () => {
        const entries = Array.from({ length: 40 }, (_, i) => ({
            pid: `pid-${String(i).padStart(2, "0")}`,
            tickets: (i % 5) + 1,
        }));
        const rank = (count: number) =>
            rankCandidates({
                randomness: RANDOMNESS,
                gameId: "game",
                entries,
                count,
            });

        expect(rank(30).slice(0, 10)).toEqual(rank(10));
    });
});

describe("candidateVerifyBy", () => {
    const NOW = new Date("2026-11-02T10:00:00Z");
    const TOLD = new Date("2026-11-01T18:00:00Z");

    it("ends 24 h after the candidate was told", () => {
        expect(
            candidateVerifyBy(
                { notifiedRank: 2, candidateNotifiedAt: TOLD },
                2,
                NOW
            )
        ).toEqual(new Date(TOLD.getTime() + CANDIDATE_WINDOW_MS));
    });

    it("has not started for a candidate not told yet", () => {
        expect(
            candidateVerifyBy(
                { notifiedRank: 1, candidateNotifiedAt: TOLD },
                2,
                NOW
            )
        ).toEqual(new Date(NOW.getTime() + CANDIDATE_WINDOW_MS));
    });
});

describe("frozenStandingOf", () => {
    it.each([
        [
            "a certified follower",
            { follows: true },
            false,
            { discarded: null, instagram: "certified" },
        ],
        [
            "a certified non-follower",
            { follows: false },
            false,
            { discarded: "not_following", instagram: "certified" },
        ],
        [
            "a declared player",
            null,
            true,
            { discarded: null, instagram: "declared" },
        ],
        ["a player with neither", null, false, { discarded: "not_linked" }],
    ] as const)("freezes %s", (_name, link, declared, expected) => {
        expect(frozenStandingOf(link, declared)).toEqual(expected);
    });
});
