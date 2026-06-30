import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlatformAdminService } from "./PlatformAdminService";

const ADDR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const ADDR_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as Address;
const ADDR_C = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;

// A fresh service instance per test gives a clean (unpopulated) cache, so the
// allow-list is re-parsed from the current process.env value.
beforeEach(() => {
    delete process.env.PLATFORM_ADMIN_WALLETS;
});

afterEach(() => {
    delete process.env.PLATFORM_ADMIN_WALLETS;
});

describe("PlatformAdminService", () => {
    it("returns false when env var is unset", () => {
        const service = new PlatformAdminService();
        expect(service.isPlatformAdmin(ADDR_A)).toBe(false);
    });

    it("returns false when env var is empty string", () => {
        process.env.PLATFORM_ADMIN_WALLETS = "";
        const service = new PlatformAdminService();
        expect(service.isPlatformAdmin(ADDR_A)).toBe(false);
    });

    it("returns true for an address in the allow-list", () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        const service = new PlatformAdminService();
        expect(service.isPlatformAdmin(ADDR_A)).toBe(true);
    });

    it("returns false for an address not in the allow-list", () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        const service = new PlatformAdminService();
        expect(service.isPlatformAdmin(ADDR_B)).toBe(false);
    });

    it("is case-insensitive: uppercase address matches", () => {
        // ADDR_B is uppercase; the list entry is lowercased by the service
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_B;
        const service = new PlatformAdminService();
        expect(service.isPlatformAdmin(ADDR_B)).toBe(true);
        // Also works when checked with lowercase
        expect(service.isPlatformAdmin(ADDR_B.toLowerCase() as Address)).toBe(
            true
        );
    });

    it("handles multiple addresses in a comma-separated list", () => {
        process.env.PLATFORM_ADMIN_WALLETS = `${ADDR_A}, ${ADDR_B}`;
        const service = new PlatformAdminService();
        expect(service.isPlatformAdmin(ADDR_A)).toBe(true);
        expect(service.isPlatformAdmin(ADDR_B)).toBe(true);
        expect(service.isPlatformAdmin(ADDR_C)).toBe(false);
    });

    it("skips invalid entries without throwing", () => {
        process.env.PLATFORM_ADMIN_WALLETS = `not-an-address, ${ADDR_A}, also-bad`;
        const service = new PlatformAdminService();
        // Should not throw; valid address is still recognized
        expect(() => service.isPlatformAdmin(ADDR_A)).not.toThrow();
        expect(service.isPlatformAdmin(ADDR_A)).toBe(true);
        expect(service.isPlatformAdmin(ADDR_C)).toBe(false);
    });

    it("memoizes: second call uses cache even if env changes mid-flight", () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        const service = new PlatformAdminService();
        expect(service.isPlatformAdmin(ADDR_A)).toBe(true);

        // Mutate env — cache should hold for the lifetime of this instance
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_C;
        expect(service.isPlatformAdmin(ADDR_A)).toBe(true); // still from cache
        expect(service.isPlatformAdmin(ADDR_C)).toBe(false); // not in original cache
    });
});
