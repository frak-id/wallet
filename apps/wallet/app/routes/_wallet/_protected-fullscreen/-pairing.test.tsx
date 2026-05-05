import { PairingNotFoundError } from "@frak-labs/wallet-shared";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { getPairingErrorState } from "./pairing";

describe("PairingPage", () => {
    describe("getPairingErrorState", () => {
        test("should return none when query has no error", () => {
            expect(getPairingErrorState(false, null)).toBe("none");
        });

        test("should return not-found when query fails with a 404 error", () => {
            expect(getPairingErrorState(true, new PairingNotFoundError())).toBe(
                "not-found"
            );
        });

        test("should return transient when query fails with non-404 error", () => {
            expect(getPairingErrorState(true, new Error("Network error"))).toBe(
                "transient"
            );
        });
    });
});
