import { describe, expect, test } from "@/tests/vitest-fixtures";
import { recoverySetupKey } from "./recovery-setup";

describe("recoverySetupKey.setup", () => {
    test("scopes the key to the address", ({ mockAddress }) => {
        expect(recoverySetupKey.setup(mockAddress)).toEqual([
            "recovery-setup",
            "setup",
            mockAddress,
        ]);
    });

    test("falls back to no-address when the address is missing", () => {
        expect(recoverySetupKey.setup(undefined)).toEqual([
            "recovery-setup",
            "setup",
            "no-address",
        ]);
    });
});
