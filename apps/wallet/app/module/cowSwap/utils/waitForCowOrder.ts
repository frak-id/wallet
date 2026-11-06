import type { Hex } from "viem";
import { fetchCowOrder } from "./cowApi";

const POLL_INTERVAL_MS = 3_000;
/** Solvers settle well within this once the pre-signature lands; past it the order is left to expire. */
const GRACE_AFTER_VALID_TO_S = 60;

export type CowOrderFailure = "expired" | "cancelled";

export function createCowOrderError(reason: CowOrderFailure) {
    const error = Object.assign(new Error(`CoW order ${reason}`), { reason });
    error.name = "CowOrderError";
    return error;
}

export function isCowOrderError(
    error: unknown
): error is Error & { reason: CowOrderFailure } {
    return error instanceof Error && error.name === "CowOrderError";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls the orderbook until the order fills, returning the amount bought. */
export async function waitForCowOrder(
    uid: Hex,
    validTo: number,
    now: () => number = Date.now
): Promise<bigint> {
    for (;;) {
        const order = await fetchCowOrder(uid);
        if (order.status === "fulfilled") return order.executedBuyAmount;
        if (order.status === "cancelled") {
            throw createCowOrderError("cancelled");
        }
        const deadlineMs = (validTo + GRACE_AFTER_VALID_TO_S) * 1000;
        if (order.status === "expired" || now() > deadlineMs) {
            throw createCowOrderError("expired");
        }
        await sleep(POLL_INTERVAL_MS);
    }
}
