import type { Hex } from "viem";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { type CowOrder, fetchCowOrder } from "./cowApi";
import { isCowOrderError, waitForCowOrder } from "./waitForCowOrder";

vi.mock("./cowApi", () => ({ fetchCowOrder: vi.fn() }));

const UID: Hex = "0x01";
const VALID_TO = 1_000;

function order(status: CowOrder["status"], bought = 0n): CowOrder {
    return { uid: UID, status, executedBuyAmount: bought };
}

describe("waitForCowOrder", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.mocked(fetchCowOrder).mockReset();
    });

    test("polls through pending states and returns the bought amount", async () => {
        vi.mocked(fetchCowOrder)
            .mockResolvedValueOnce(order("presignaturePending"))
            .mockResolvedValueOnce(order("open"))
            .mockResolvedValueOnce(order("fulfilled", 111n));

        const result = waitForCowOrder(UID, VALID_TO, () => 0);
        await vi.advanceTimersByTimeAsync(10_000);

        await expect(result).resolves.toBe(111n);
        expect(fetchCowOrder).toHaveBeenCalledTimes(3);
    });

    test.each(["expired", "cancelled"] as const)(
        "rejects when the orderbook reports %s",
        async (status) => {
            vi.mocked(fetchCowOrder).mockResolvedValueOnce(order(status));

            const error = await waitForCowOrder(UID, VALID_TO, () => 0).catch(
                (e: unknown) => e
            );

            expect(isCowOrderError(error) && error.reason).toBe(status);
        }
    );

    test("gives up once validTo plus the grace period has passed", async () => {
        vi.mocked(fetchCowOrder).mockResolvedValue(order("open"));

        const error = await waitForCowOrder(
            UID,
            VALID_TO,
            () => (VALID_TO + 61) * 1000
        ).catch((e: unknown) => e);

        expect(isCowOrderError(error) && error.reason).toBe("expired");
    });
});
