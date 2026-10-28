import { describe, expect, it } from "vitest";
import {
    DRAND_QUICKNET,
    drandRandomness,
    drandRoundTime,
    rankCandidates,
    snapshotRoot,
} from "./draw";
import type { PublicDraw } from "./schemas";
import { verifyPublicDraw } from "./verify";

// Quicknet round 33416581, as served by api.drand.sh on 2026-10-26.
const ROUND = 33416581;
const SIGNATURE =
    "8592d3ce0c351457c9e974c046c6c72f597b125a1ac60ab1003419b7246a9bad80704d40cb67b046cfd77be4f5bf619e";
const GAME_ID = "11111111-1111-4111-8111-111111111111";
const ENTRIES = [
    { pid: "aa", tickets: 3 },
    { pid: "bb", tickets: 1 },
    { pid: "cc", tickets: 5 },
];

function drawRecord(overrides: Partial<PublicDraw> = {}): PublicDraw {
    const randomness = drandRandomness(SIGNATURE);
    const candidates = rankCandidates({
        randomness,
        gameId: GAME_ID,
        entries: ENTRIES,
        count: 30,
    });
    return {
        gameId: GAME_ID,
        algorithm: "frak-draw-v2",
        status: "confirmed",
        frozenAt: new Date(drandRoundTime(ROUND).getTime() - 10 * 60 * 1000),
        snapshotRoot: snapshotRoot(ENTRIES),
        totalTickets: 9,
        participants: 3,
        discardedParticipants: 0,
        entries: ENTRIES,
        drand: {
            chainHash: DRAND_QUICKNET.chainHash,
            round: ROUND,
            roundTime: drandRoundTime(ROUND),
            signature: SIGNATURE,
            randomness,
        },
        candidates,
        rejections: [
            { pid: candidates[0] ?? "", reason: "fraud", at: "2026-10-27" },
        ],
        winnerPid: candidates[1] ?? null,
        payoutTxHash: null,
        ...overrides,
    };
}

const failing = (draw: PublicDraw) =>
    verifyPublicDraw(draw)
        .filter((check) => !check.ok)
        .map((check) => check.id);

describe("verifyPublicDraw", () => {
    it("passes every check on a genuine record", () => {
        const checks = verifyPublicDraw(drawRecord());
        expect(checks).toHaveLength(10);
        expect(checks.every((check) => check.ok)).toBe(true);
    });

    it("skips the beacon checks until the signature is out", () => {
        const pending = drawRecord({
            drand: { ...drawRecord().drand, signature: null, randomness: null },
            winnerPid: null,
        });
        expect(verifyPublicDraw(pending).map((check) => check.id)).toEqual([
            "algorithm_known",
            "root_matches",
            "total_matches",
            "quicknet_beacon",
            "round_after_freeze",
        ]);
    });

    it.each([
        {
            name: "an edited list",
            draw: () =>
                drawRecord({
                    entries: [...ENTRIES, { pid: "dd", tickets: 2 }],
                }),
            fails: ["root_matches", "total_matches", "candidates_replay"],
        },
        {
            name: "a round committed before the freeze",
            draw: () => drawRecord({ frozenAt: drandRoundTime(ROUND + 1) }),
            fails: ["round_after_freeze"],
        },
        {
            name: "a forged signature",
            draw: () =>
                drawRecord({
                    drand: {
                        ...drawRecord().drand,
                        signature: `${SIGNATURE.slice(0, -2)}00`,
                    },
                }),
            fails: ["beacon_signed", "randomness_matches", "candidates_replay"],
        },
        {
            name: "a winner who skipped the queue",
            draw: () => drawRecord({ winnerPid: drawRecord().candidates[2] }),
            fails: ["winner_first_unrejected"],
        },
        {
            name: "an unknown algorithm",
            draw: () => drawRecord({ algorithm: "frak-draw-v9" }),
            fails: ["algorithm_known", "candidates_replay"],
        },
    ])("flags $name", ({ draw, fails }) => {
        expect(failing(draw())).toEqual(fails);
    });
});
