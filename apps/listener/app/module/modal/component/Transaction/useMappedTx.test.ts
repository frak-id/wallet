import { describe, expect, test } from "@/tests/fixtures";

function shouldGuard(
    tx: object | undefined,
    address: string | undefined
): boolean {
    return !tx || !address;
}

function oldBuggyGuard(
    tx: object | undefined,
    address: string | undefined
): boolean {
    return !(tx || !address);
}

describe("useMappedTx guard condition", () => {
    test("should guard when tx is undefined", () => {
        expect(shouldGuard(undefined, "0x1234")).toBe(true);
    });

    test("should guard when address is undefined", () => {
        expect(shouldGuard({ to: "0x1234" }, undefined)).toBe(true);
    });

    test("should pass when both tx and address exist", () => {
        expect(shouldGuard({ to: "0x1234" }, "0x5678")).toBe(false);
    });

    test("should guard when both are undefined", () => {
        expect(shouldGuard(undefined, undefined)).toBe(true);
    });

    test("old buggy condition failed when both undefined", () => {
        expect(oldBuggyGuard(undefined, undefined)).toBe(false);
        expect(shouldGuard(undefined, undefined)).toBe(true);
    });
});
