import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPlatformAdmin } from "../../auth/services/PlatformAdminService";
import { MerchantAuthorizationService } from "./MerchantAuthorizationService";

// MerchantAuthorizationService is domain-clean and does not call isPlatformAdmin.
// The platform-admin bypass lives in session.ts (hasMerchantAccess closure).
// We mock PlatformAdminService here to keep the simulateHasMerchantAccess
// helper deterministic without depending on env vars or module-level cache state.
vi.mock("../../auth/services/PlatformAdminService", () => ({
    isPlatformAdmin: (wallet: Address) =>
        wallet.toLowerCase() === PLATFORM_ADMIN.toLowerCase(),
}));

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const ADMIN_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const PLATFORM_ADMIN = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
const STRANGER = "0xdddddddddddddddddddddddddddddddddddddddd" as Address;

const MERCHANT_ID = "merchant-123";

function makeService(opts: { ownerWallet?: Address; isAdmin?: boolean } = {}) {
    const ownerWallet = opts.ownerWallet ?? OWNER;

    const merchantRepo = {
        findById: vi.fn((_id: string) =>
            Promise.resolve(
                _id === MERCHANT_ID
                    ? ({
                          id: MERCHANT_ID,
                          ownerWallet,
                      } as never)
                    : null
            )
        ),
    };
    const adminRepo = {
        isAdmin: vi.fn((_id: string, wallet: Address) =>
            Promise.resolve(
                opts.isAdmin === true ? wallet === ADMIN_WALLET : false
            )
        ),
    };
    return new MerchantAuthorizationService(
        merchantRepo as never,
        adminRepo as never
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("MerchantAuthorizationService.checkAccess", () => {
    it("returns owner role for merchant owner", async () => {
        const svc = makeService({ ownerWallet: OWNER });
        const result = await svc.checkAccess(MERCHANT_ID, OWNER);
        expect(result).toMatchObject({
            hasAccess: true,
            isOwner: true,
            role: "owner",
        });
    });

    it("returns admin role for a merchant admin", async () => {
        const svc = makeService({ isAdmin: true });
        const result = await svc.checkAccess(MERCHANT_ID, ADMIN_WALLET);
        expect(result).toMatchObject({
            hasAccess: true,
            isOwner: false,
            isAdmin: true,
            role: "admin",
        });
    });

    it("returns none role with hasAccess:false for a platform admin — role is derived upstream in merchant/index.ts", async () => {
        // checkAccess is now auth-domain-free. A platform admin has no real
        // merchant relationship so it falls through to role:"none".
        // The "platform_admin" role is derived in the GET /:merchantId handler
        // after checkAccess returns, keeping MerchantAuthorizationService clean.
        const svc = makeService();
        const result = await svc.checkAccess(MERCHANT_ID, PLATFORM_ADMIN);
        expect(result).toMatchObject({
            hasAccess: false,
            isOwner: false,
            isAdmin: false,
            role: "none",
        });
    });

    it("returns none for an unrelated wallet", async () => {
        const svc = makeService();
        const result = await svc.checkAccess(MERCHANT_ID, STRANGER);
        expect(result).toMatchObject({
            hasAccess: false,
            role: "none",
        });
    });

    it("returns none for an unknown merchant", async () => {
        const svc = makeService();
        const result = await svc.checkAccess("nonexistent", PLATFORM_ADMIN);
        expect(result).toMatchObject({ hasAccess: false, role: "none" });
    });
});

describe("MerchantAuthorizationService.hasAccess (write gate)", () => {
    it("returns true for the owner", async () => {
        const svc = makeService({ ownerWallet: OWNER });
        expect(await svc.hasAccess(MERCHANT_ID, OWNER)).toBe(true);
    });

    it("returns false for a platform admin — write gate is unaffected", async () => {
        const svc = makeService();
        expect(await svc.hasAccess(MERCHANT_ID, PLATFORM_ADMIN)).toBe(false);
    });

    it("returns false for a stranger", async () => {
        const svc = makeService();
        expect(await svc.hasAccess(MERCHANT_ID, STRANGER)).toBe(false);
    });
});

describe("platform admin read bypass (hasMerchantAccess closure logic)", () => {
    const SAFE_METHODS = new Set(["GET", "HEAD"]);

    /**
     * Mirrors the `hasMerchantAccess` closure in
     * `services/backend/src/api/business/middleware/session.ts`.
     *
     * KEEP IN SYNC with that closure: if the bypass logic in session.ts changes
     * (e.g. new safe methods, additional conditions), update this helper and
     * the test cases below to match, or add a session.test.ts integration test.
     */
    async function simulateHasMerchantAccess(
        wallet: Address,
        merchantId: string,
        method: string,
        svc: MerchantAuthorizationService
    ): Promise<boolean> {
        if (await svc.hasAccess(merchantId, wallet)) return true;
        if (isPlatformAdmin(wallet) && SAFE_METHODS.has(method)) return true;
        return false;
    }

    it("grants GET access to platform admin on a foreign merchant", async () => {
        const svc = makeService();
        expect(
            await simulateHasMerchantAccess(
                PLATFORM_ADMIN,
                MERCHANT_ID,
                "GET",
                svc
            )
        ).toBe(true);
    });

    it("denies POST to platform admin on a foreign merchant", async () => {
        const svc = makeService();
        expect(
            await simulateHasMerchantAccess(
                PLATFORM_ADMIN,
                MERCHANT_ID,
                "POST",
                svc
            )
        ).toBe(false);
    });

    it("denies PUT to platform admin on a foreign merchant", async () => {
        const svc = makeService();
        expect(
            await simulateHasMerchantAccess(
                PLATFORM_ADMIN,
                MERCHANT_ID,
                "PUT",
                svc
            )
        ).toBe(false);
    });

    it("denies DELETE to platform admin on a foreign merchant", async () => {
        const svc = makeService();
        expect(
            await simulateHasMerchantAccess(
                PLATFORM_ADMIN,
                MERCHANT_ID,
                "DELETE",
                svc
            )
        ).toBe(false);
    });

    it("grants GET access to the real owner (unaffected by platform admin logic)", async () => {
        const svc = makeService({ ownerWallet: OWNER });
        expect(
            await simulateHasMerchantAccess(OWNER, MERCHANT_ID, "GET", svc)
        ).toBe(true);
    });

    it("grants POST access to the real owner (write-gate unchanged)", async () => {
        const svc = makeService({ ownerWallet: OWNER });
        expect(
            await simulateHasMerchantAccess(OWNER, MERCHANT_ID, "POST", svc)
        ).toBe(true);
    });

    it("denies GET for a stranger (neither owner/admin nor platform admin)", async () => {
        const svc = makeService();
        expect(
            await simulateHasMerchantAccess(STRANGER, MERCHANT_ID, "GET", svc)
        ).toBe(false);
    });
});
