import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { sdkKey } from "./sdk";

describe("sdkKey", () => {
    describe("token.bySession", () => {
        it("should generate key with both address and lastActionWallet", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const lastActionWallet =
                "0xabcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result = sdkKey.token.bySession(address, lastActionWallet);

            expect(result).toEqual(["sdk", "token", address, lastActionWallet]);
        });

        it("should use no-session fallback when address is undefined", () => {
            const lastActionWallet =
                "0xabcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result = sdkKey.token.bySession(undefined, lastActionWallet);

            expect(result).toEqual([
                "sdk",
                "token",
                "no-session",
                lastActionWallet,
            ]);
        });

        it("should use no-last-action fallback when lastActionWallet is undefined", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;

            const result = sdkKey.token.bySession(address, undefined);

            expect(result).toEqual(["sdk", "token", address, "no-last-action"]);
        });

        it("should use both fallbacks when both parameters are undefined", () => {
            const result = sdkKey.token.bySession(undefined, undefined);

            expect(result).toEqual([
                "sdk",
                "token",
                "no-session",
                "no-last-action",
            ]);
        });

        it("should use both fallbacks when no parameters provided", () => {
            const result = sdkKey.token.bySession();

            expect(result).toEqual([
                "sdk",
                "token",
                "no-session",
                "no-last-action",
            ]);
        });

        it("should return array with exactly 4 elements", () => {
            const result = sdkKey.token.bySession();

            expect(result).toHaveLength(4);
        });

        it("should include base keys as first two elements", () => {
            const result = sdkKey.token.bySession();

            expect(result[0]).toBe("sdk");
            expect(result[1]).toBe("token");
        });

        it("should be deterministic for same parameters", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const lastActionWallet =
                "0xabcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result1 = sdkKey.token.bySession(address, lastActionWallet);
            const result2 = sdkKey.token.bySession(address, lastActionWallet);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;
            const lastActionWallet =
                "0xabcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result1 = sdkKey.token.bySession(address1, lastActionWallet);
            const result2 = sdkKey.token.bySession(address2, lastActionWallet);

            expect(result1).not.toEqual(result2);
        });

        it("should generate different keys for different lastActionWallets", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const lastActionWallet1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const lastActionWallet2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = sdkKey.token.bySession(address, lastActionWallet1);
            const result2 = sdkKey.token.bySession(address, lastActionWallet2);

            expect(result1).not.toEqual(result2);
        });
    });
});
