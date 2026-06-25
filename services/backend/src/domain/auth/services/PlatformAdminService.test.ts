import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ADDR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const ADDR_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as Address;
const ADDR_C = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;

// Reset the module registry before each test so the memoized _cache is
// discarded and a fresh import picks up the current process.env value.
beforeEach(() => {
    vi.resetModules();
    delete process.env.PLATFORM_ADMIN_WALLETS;
});

afterEach(() => {
    delete process.env.PLATFORM_ADMIN_WALLETS;
});

async function importService() {
    const mod = await import("./PlatformAdminService");
    return mod.isPlatformAdmin;
}

describe("isPlatformAdmin", () => {
    it("returns false when env var is unset", async () => {
        const isPlatformAdmin = await importService();
        expect(isPlatformAdmin(ADDR_A)).toBe(false);
    });

    it("returns false when env var is empty string", async () => {
        process.env.PLATFORM_ADMIN_WALLETS = "";
        const isPlatformAdmin = await importService();
        expect(isPlatformAdmin(ADDR_A)).toBe(false);
    });

    it("returns true for an address in the allow-list", async () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        const isPlatformAdmin = await importService();
        expect(isPlatformAdmin(ADDR_A)).toBe(true);
    });

    it("returns false for an address not in the allow-list", async () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        const isPlatformAdmin = await importService();
        expect(isPlatformAdmin(ADDR_B)).toBe(false);
    });

    it("is case-insensitive: uppercase address matches", async () => {
        // ADDR_B is uppercase; the list entry is lowercased by the service
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_B;
        const isPlatformAdmin = await importService();
        expect(isPlatformAdmin(ADDR_B)).toBe(true);
        // Also works when checked with lowercase
        expect(isPlatformAdmin(ADDR_B.toLowerCase() as Address)).toBe(true);
    });

    it("handles multiple addresses in a comma-separated list", async () => {
        process.env.PLATFORM_ADMIN_WALLETS = `${ADDR_A}, ${ADDR_B}`;
        const isPlatformAdmin = await importService();
        expect(isPlatformAdmin(ADDR_A)).toBe(true);
        expect(isPlatformAdmin(ADDR_B)).toBe(true);
        expect(isPlatformAdmin(ADDR_C)).toBe(false);
    });

    it("skips invalid entries without throwing", async () => {
        process.env.PLATFORM_ADMIN_WALLETS = `not-an-address, ${ADDR_A}, also-bad`;
        const isPlatformAdmin = await importService();
        // Should not throw; valid address is still recognized
        expect(() => isPlatformAdmin(ADDR_A)).not.toThrow();
        expect(isPlatformAdmin(ADDR_A)).toBe(true);
        expect(isPlatformAdmin(ADDR_C)).toBe(false);
    });

    it("memoizes: second call uses cache even if env changes mid-flight", async () => {
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_A;
        const isPlatformAdmin = await importService();
        expect(isPlatformAdmin(ADDR_A)).toBe(true);

        // Mutate env — cache should hold for the lifetime of this module instance
        process.env.PLATFORM_ADMIN_WALLETS = ADDR_C;
        expect(isPlatformAdmin(ADDR_A)).toBe(true); // still from cache
        expect(isPlatformAdmin(ADDR_C)).toBe(false); // ADDR_C not in original cache
    });
});
