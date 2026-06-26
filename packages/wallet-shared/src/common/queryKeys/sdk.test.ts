import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { sdkKey } from "./sdk";

describe("sdkKey", () => {
    describe("token.bySession", () => {
        it("should generate key with address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;

            const result = sdkKey.token.bySession(address);

            expect(result).toEqual(["sdk", "token", address]);
        });

        it("should use no-session fallback when address is undefined", () => {
            const result = sdkKey.token.bySession(undefined);

            expect(result).toEqual(["sdk", "token", "no-session"]);
        });

        it("should use no-session fallback when no parameters provided", () => {
            const result = sdkKey.token.bySession();

            expect(result).toEqual(["sdk", "token", "no-session"]);
        });

        it("should return array with exactly 3 elements", () => {
            const result = sdkKey.token.bySession();

            expect(result).toHaveLength(3);
        });

        it("should include base keys as first two elements", () => {
            const result = sdkKey.token.bySession();

            expect(result[0]).toBe("sdk");
            expect(result[1]).toBe("token");
        });

        it("should be deterministic for same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;

            const result1 = sdkKey.token.bySession(address);
            const result2 = sdkKey.token.bySession(address);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = sdkKey.token.bySession(address1);
            const result2 = sdkKey.token.bySession(address2);

            expect(result1).not.toEqual(result2);
        });
    });
});
