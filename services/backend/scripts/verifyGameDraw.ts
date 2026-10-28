import { parseArgs } from "node:util";
import {
    DRAND_QUICKNET,
    drandRandomness,
    drandRoundTime,
    drawCandidatesFor,
    rankCandidates,
    snapshotRoot,
    verifyDrandBeacon,
} from "../src/domain/game/draw";
import type { PublicDraw } from "../src/domain/game/schemas";

const USAGE = `Usage: bun scripts/verifyGameDraw.ts <gameId> [--api https://backend.frak.id]
Replays a Frak Game draw from its public record, without trusting Frak:
the frozen list's hash, the drand beacon's signature, the ranking and the winner.`;

const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { api: { type: "string", default: "https://backend.frak.id" } },
});
const [gameId] = positionals;
if (!gameId) {
    console.error(USAGE);
    process.exit(1);
}

const response = await fetch(`${values.api}/common/game/${gameId}/draw`);
if (!response.ok) {
    console.error(`No draw record (${response.status})`);
    process.exit(1);
}
const draw = (await response.json()) as PublicDraw;

const candidateCount = drawCandidatesFor(draw.algorithm);
const checks: [string, boolean][] = [
    [`algorithm ${draw.algorithm} is known`, candidateCount !== null],
    [
        "the snapshot root hashes the published list",
        snapshotRoot(draw.entries) === draw.snapshotRoot,
    ],
    [
        "the ticket total adds up",
        draw.entries.reduce((sum, e) => sum + e.tickets, 0) ===
            draw.totalTickets,
    ],
    [
        "the beacon is quicknet's",
        draw.drand.chainHash === DRAND_QUICKNET.chainHash,
    ],
    [
        "the round came out after the freeze",
        drandRoundTime(draw.drand.round) > new Date(draw.frozenAt),
    ],
];

const signature = draw.drand.signature;
if (signature) {
    checks.push(
        [
            "drand signed this round",
            verifyDrandBeacon(draw.drand.round, signature),
        ],
        [
            "the randomness comes from the signature",
            drandRandomness(signature) === draw.drand.randomness,
        ]
    );
    const replayed = rankCandidates({
        randomness: drandRandomness(signature),
        gameId: draw.gameId,
        entries: draw.entries,
        count: candidateCount ?? 0,
    });
    checks.push([
        "the candidates replay in the same order",
        JSON.stringify(replayed) === JSON.stringify(draw.candidates),
    ]);
    checks.push([
        "each rejection passed over the next candidate in order",
        draw.rejections.every((r, i) => r.pid === draw.candidates[i]),
    ]);
    if (draw.winnerPid) {
        checks.push([
            "the winner is the first candidate not rejected",
            draw.winnerPid === draw.candidates[draw.rejections.length],
        ]);
    }
} else {
    console.log(`Beacon pending: round ${draw.drand.round}`);
}

for (const [name, ok] of checks) console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
console.log(
    `${draw.status}: ${draw.entries.length} eligible players, ${draw.totalTickets} tickets, winner ${draw.winnerPid ?? "none yet"}`
);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
