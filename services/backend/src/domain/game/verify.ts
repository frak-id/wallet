import {
    DRAND_QUICKNET,
    drandRandomness,
    drandRoundTime,
    drawCandidatesFor,
    rankCandidates,
    snapshotRoot,
    verifyDrandBeacon,
} from "./draw";
import type { PublicDraw } from "./schemas";

export const DRAW_CHECK_IDS = [
    "algorithm_known",
    "root_matches",
    "total_matches",
    "quicknet_beacon",
    "round_after_freeze",
    "beacon_signed",
    "randomness_matches",
    "candidates_replay",
    "rejections_in_order",
    "winner_first_unrejected",
] as const;

export type DrawCheckId = (typeof DRAW_CHECK_IDS)[number];

export type DrawCheck = { id: DrawCheckId; ok: boolean };

/** Replays a draw from its public record alone; the beacon checks only run once the signature is out. */
export function verifyPublicDraw(draw: PublicDraw): DrawCheck[] {
    const candidateCount = drawCandidatesFor(draw.algorithm);
    const checks: DrawCheck[] = [
        { id: "algorithm_known", ok: candidateCount !== null },
        {
            id: "root_matches",
            ok: snapshotRoot(draw.entries) === draw.snapshotRoot,
        },
        {
            id: "total_matches",
            ok:
                draw.entries.reduce((sum, e) => sum + e.tickets, 0) ===
                draw.totalTickets,
        },
        {
            id: "quicknet_beacon",
            ok: draw.drand.chainHash === DRAND_QUICKNET.chainHash,
        },
        {
            id: "round_after_freeze",
            ok: drandRoundTime(draw.drand.round) > new Date(draw.frozenAt),
        },
    ];

    const signature = draw.drand.signature;
    if (!signature) return checks;

    const randomness = drandRandomness(signature);
    const replayed = rankCandidates({
        randomness,
        gameId: draw.gameId,
        entries: draw.entries,
        count: candidateCount ?? 0,
    });
    checks.push(
        {
            id: "beacon_signed",
            ok: verifyDrandBeacon(draw.drand.round, signature),
        },
        { id: "randomness_matches", ok: randomness === draw.drand.randomness },
        {
            id: "candidates_replay",
            ok: JSON.stringify(replayed) === JSON.stringify(draw.candidates),
        },
        {
            id: "rejections_in_order",
            ok: draw.rejections.every((r, i) => r.pid === draw.candidates[i]),
        }
    );
    if (draw.winnerPid) {
        checks.push({
            id: "winner_first_unrejected",
            ok: draw.winnerPid === draw.candidates[draw.rejections.length],
        });
    }
    return checks;
}
