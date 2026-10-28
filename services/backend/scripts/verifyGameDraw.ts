import { parseArgs } from "node:util";
import type { PublicDraw } from "../src/domain/game/schemas";
import { type DrawCheckId, verifyPublicDraw } from "../src/domain/game/verify";

const USAGE = `Usage: bun scripts/verifyGameDraw.ts <gameId> [--api https://backend.frak.id]
Replays a Frak Game draw from its public record, without trusting Frak:
the frozen list's hash, the drand beacon's signature, the ranking and the winner.`;

const LABELS: Record<DrawCheckId, string> = {
    algorithm_known: "the algorithm is known",
    root_matches: "the snapshot root hashes the published list",
    total_matches: "the ticket total adds up",
    quicknet_beacon: "the beacon is quicknet's",
    round_after_freeze: "the round came out after the freeze",
    beacon_signed: "drand signed this round",
    randomness_matches: "the randomness comes from the signature",
    candidates_replay: "the candidates replay in the same order",
    rejections_in_order:
        "each rejection passed over the next candidate in order",
    winner_first_unrejected: "the winner is the first candidate not rejected",
};

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

if (!draw.drand.signature) {
    console.log(`Beacon pending: round ${draw.drand.round}`);
}
const checks = verifyPublicDraw(draw);
for (const { id, ok } of checks) {
    console.log(`${ok ? "ok  " : "FAIL"} ${LABELS[id]}`);
}
console.log(
    `${draw.status}: ${draw.entries.length} eligible players, ${draw.totalTickets} tickets, winner ${draw.winnerPid ?? "none yet"}`
);
process.exit(checks.every(({ ok }) => ok) ? 0 : 1);
