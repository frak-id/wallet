import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { generateSetupCode } from "./mint";

describe("setup code generation", () => {
    const wallet = "0x1234567890abcdef1234567890abcdef12345678" as Address;
    const salt = "test-salt";

    it("returns a valid hex hash", () => {
        const code = generateSetupCode("shop.com", wallet, salt);
        expect(code).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("is deterministic", () => {
        const a = generateSetupCode("shop.com", wallet, salt);
        const b = generateSetupCode("shop.com", wallet, salt);
        expect(a).toBe(b);
    });

    it("changes with different domain", () => {
        const a = generateSetupCode("shop-a.com", wallet, salt);
        const b = generateSetupCode("shop-b.com", wallet, salt);
        expect(a).not.toBe(b);
    });

    it("changes with different wallet", () => {
        const walletB = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;
        const a = generateSetupCode("shop.com", wallet, salt);
        const b = generateSetupCode("shop.com", walletB, salt);
        expect(a).not.toBe(b);
    });

    it("changes with different salt", () => {
        const a = generateSetupCode("shop.com", wallet, "salt-a");
        const b = generateSetupCode("shop.com", wallet, "salt-b");
        expect(a).not.toBe(b);
    });

    it("handles empty salt", () => {
        const code = generateSetupCode("shop.com", wallet, "");
        expect(code).toMatch(/^0x[0-9a-f]{64}$/);
    });
});
