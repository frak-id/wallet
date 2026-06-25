import type { Address } from "viem";
import { afterEach, describe, expect, it } from "vitest";
import {
    _resetPlatformAdminCache,
    isPlatformAdmin,
} from "./PlatformAdminService";

const ADDR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const ADDR_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as Address;
const ADDR_C = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;

afterEach(() => {
    _resetPlatformAdminCache();
    delete process.env.PLATFORM_ADMIN_WALLETS;
});

describe("isPlatformAdmin", () => {
    it("returns false when env var is unset", () => {
        delete process.env.PLATFORM_ADMIN_WALLETS;
        expect(isPlatformAdmin(ADDR_A)).toBe(false);
    });

    it("returns false when env var is empty string", () => {
        process.env.PLATFORM_ADMIN_WALLETS = "";
        expect(isPlatformAdmin(ADDR_A)).toBe(false);
    });

    it("returns true for an address in the allow-list", () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        expect(isPlatformAdmin(ADDR_A)).toBe(true);
    });

    it("returns false for an address not in the allow-list", () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        expect(isPlatformAdmin(ADDR_B)).toBe(false);
    });

    it("is case-insensitive: uppercase address matches", () => {
        // ADDR_B is uppercase; the list entry is lowercased by the service
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_B;
        expect(isPlatformAdmin(ADDR_B)).toBe(true);
        // Also works when checked with lowercase
        expect(isPlatformAdmin(ADDR_B.toLowerCase() as Address)).toBe(true);
    });

    it("handles multiple addresses in a comma-separated list", () => {
        process.env.PLATFORM_ADMIN_WALLETS = `${ADDR_A}, ${ADDR_B}`;
        expect(isPlatformAdmin(ADDR_A)).toBe(true);
        expect(isPlatformAdmin(ADDR_B)).toBe(true);
        expect(isPlatformAdmin(ADDR_C)).toBe(false);
    });

    it("skips invalid entries without throwing", () => {
        process.env.PLATFORM_ADMIN_WALLETS = `not-an-address, ${ADDR_A}, also-bad`;
        // Should not throw; valid address is still recognized
        expect(() => isPlatformAdmin(ADDR_A)).not.toThrow();
        expect(isPlatformAdmin(ADDR_A)).toBe(true);
        expect(isPlatformAdmin(ADDR_C)).toBe(false);
    });

    it("memoizes: second call uses cache even if env changes", () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        expect(isPlatformAdmin(ADDR_A)).toBe(true);

        // Mutate env — cache should hold
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_C;
        expect(isPlatformAdmin(ADDR_A)).toBe(true); // still from cache
        expect(isPlatformAdmin(ADDR_C)).toBe(false); // ADDR_C not in original cache

        // After reset, picks up new env
        _resetPlatformAdminCache();
        expect(isPlatformAdmin(ADDR_A)).toBe(false);
        expect(isPlatformAdmin(ADDR_C)).toBe(true);
    });
});
