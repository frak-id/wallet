import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MerchantAuthorizationService } from "./MerchantAuthorizationService";

// MerchantAuthorizationService is domain-clean and does not know about platform
// admins. The platform-admin bypass lives in session.ts (hasMerchantAccess
// closure), which the simulateHasMerchantAccess helper below mirrors using a
// local predicate so the test stays independent of PlatformAdminService.
const isSimulatedPlatformAdmin = (wallet: Address) =>
    wallet.toLowerCase() === PLATFORM_ADMIN.toLowerCase();

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const ADMIN_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const PLATFORM_ADMIN = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
const STRANGER = "0xdddddddddddddddddddddddddddddddddddddddd" as Address;

const OWNER_ACCOUNT = "11111111-1111-4111-8111-111111111111";
const ADMIN_ACCOUNT = "22222222-2222-4222-8222-222222222222";
const STRANGER_ACCOUNT = "33333333-3333-4333-8333-333333333333";

const MERCHANT_ID = "merchant-123";

function makeService(
    opts: {
        ownerWallet?: Address | null;
        ownerAccountId?: string | null;
        adminWallets?: Address[];
        adminAccountIds?: string[];
        domain?: string;
        allowedDomains?: string[] | null;
    } = {}
) {
    const ownerWallet =
        opts.ownerWallet === undefined ? OWNER : opts.ownerWallet;
    const ownerAccountId = opts.ownerAccountId ?? null;
    const adminWallets = opts.adminWallets ?? [];
    const adminAccountIds = opts.adminAccountIds ?? [];
    const domain = opts.domain ?? "brand.com";
    const allowedDomains = opts.allowedDomains ?? null;

    const merchant = {
        id: MERCHANT_ID,
        ownerWallet,
        ownerAccountId,
        domain,
        allowedDomains,
    };

    const merchantRepo = {
        findById: vi.fn((_id: string) =>
            Promise.resolve(_id === MERCHANT_ID ? (merchant as never) : null)
        ),
        findByOwnerWallet: vi.fn((wallet: Address) =>
            Promise.resolve(
                ownerWallet === wallet ? [{ id: MERCHANT_ID } as never] : []
            )
        ),
        findByOwnerAccount: vi.fn((accountId: string) =>
            Promise.resolve(
                ownerAccountId === accountId
                    ? [{ id: MERCHANT_ID } as never]
                    : []
            )
        ),
        findAll: vi.fn(() => Promise.resolve([merchant as never])),
    };
    const adminRepo = {
        isAdmin: vi.fn(
            (
                _id: string,
                identity: { wallet?: Address | null; accountId?: string | null }
            ) =>
                Promise.resolve(
                    (identity.wallet !== undefined &&
                        identity.wallet !== null &&
                        adminWallets.includes(identity.wallet)) ||
                        (!!identity.accountId &&
                            adminAccountIds.includes(identity.accountId))
                )
        ),
        findByIdentity: vi.fn(
            (identity: {
                wallet?: Address | null;
                accountId?: string | null;
            }) =>
                Promise.resolve(
                    (identity.wallet &&
                        adminWallets.includes(identity.wallet)) ||
                        (identity.accountId &&
                            adminAccountIds.includes(identity.accountId))
                        ? [{ merchantId: MERCHANT_ID } as never]
                        : []
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
    it("returns owner role for merchant owner (wallet identity)", async () => {
        const svc = makeService({ ownerWallet: OWNER });
        const result = await svc.checkAccess(MERCHANT_ID, { wallet: OWNER });
        expect(result).toMatchObject({
            hasAccess: true,
            isOwner: true,
            role: "owner",
        });
    });

    it("returns owner role for a walletless owner (account identity)", async () => {
        const svc = makeService({
            ownerWallet: null,
            ownerAccountId: OWNER_ACCOUNT,
        });
        const result = await svc.checkAccess(MERCHANT_ID, {
            wallet: null,
            accountId: OWNER_ACCOUNT,
        });
        expect(result).toMatchObject({
            hasAccess: true,
            isOwner: true,
            role: "owner",
        });
    });

    it("matches owner on the account axis even when the merchant also has a wallet", async () => {
        const svc = makeService({
            ownerWallet: OWNER,
            ownerAccountId: OWNER_ACCOUNT,
        });
        // Session has a different wallet but the owning account (e.g. after
        // wallet re-link) — account match must win.
        const result = await svc.checkAccess(MERCHANT_ID, {
            wallet: STRANGER,
            accountId: OWNER_ACCOUNT,
        });
        expect(result.role).toBe("owner");
    });

    it("returns admin role for a merchant admin (wallet identity)", async () => {
        const svc = makeService({ adminWallets: [ADMIN_WALLET] });
        const result = await svc.checkAccess(MERCHANT_ID, {
            wallet: ADMIN_WALLET,
        });
        expect(result).toMatchObject({
            hasAccess: true,
            isOwner: false,
            isAdmin: true,
            role: "admin",
        });
    });

    it("returns admin role for an account-based admin", async () => {
        const svc = makeService({ adminAccountIds: [ADMIN_ACCOUNT] });
        const result = await svc.checkAccess(MERCHANT_ID, {
            wallet: null,
            accountId: ADMIN_ACCOUNT,
        });
        expect(result.role).toBe("admin");
    });

    it("returns none for an empty identity", async () => {
        const svc = makeService();
        const result = await svc.checkAccess(MERCHANT_ID, {
            wallet: null,
            accountId: null,
        });
        expect(result).toMatchObject({ hasAccess: false, role: "none" });
    });

    it("returns none role with hasAccess:false for a platform admin — role is derived upstream in merchant/index.ts", async () => {
        // checkAccess is now auth-domain-free. A platform admin has no real
        // merchant relationship so it falls through to role:"none".
        // The "platform_admin" role is derived in the GET /:merchantId handler
        // after checkAccess returns, keeping MerchantAuthorizationService clean.
        const svc = makeService();
        const result = await svc.checkAccess(MERCHANT_ID, {
            wallet: PLATFORM_ADMIN,
        });
        expect(result).toMatchObject({
            hasAccess: false,
            isOwner: false,
            isAdmin: false,
            role: "none",
        });
    });

    it("returns none for an unrelated wallet", async () => {
        const svc = makeService();
        const result = await svc.checkAccess(MERCHANT_ID, {
            wallet: STRANGER,
            accountId: STRANGER_ACCOUNT,
        });
        expect(result).toMatchObject({
            hasAccess: false,
            role: "none",
        });
    });

    it("returns none for an unknown merchant", async () => {
        const svc = makeService();
        const result = await svc.checkAccess("nonexistent", {
            wallet: PLATFORM_ADMIN,
        });
        expect(result).toMatchObject({ hasAccess: false, role: "none" });
    });
});

describe("MerchantAuthorizationService.hasAccess (write gate)", () => {
    it("returns true for the owner", async () => {
        const svc = makeService({ ownerWallet: OWNER });
        expect(await svc.hasAccess(MERCHANT_ID, { wallet: OWNER })).toBe(true);
    });

    it("returns true for a walletless owner", async () => {
        const svc = makeService({
            ownerWallet: null,
            ownerAccountId: OWNER_ACCOUNT,
        });
        expect(
            await svc.hasAccess(MERCHANT_ID, {
                wallet: null,
                accountId: OWNER_ACCOUNT,
            })
        ).toBe(true);
    });

    it("returns false for a platform admin — write gate is unaffected", async () => {
        const svc = makeService();
        expect(
            await svc.hasAccess(MERCHANT_ID, { wallet: PLATFORM_ADMIN })
        ).toBe(false);
    });

    it("returns false for a stranger", async () => {
        const svc = makeService();
        expect(await svc.hasAccess(MERCHANT_ID, { wallet: STRANGER })).toBe(
            false
        );
    });
});

describe("MerchantAuthorizationService — Shopify SSO auto-link (§4.7)", () => {
    it("grants admin-role access when a shop domain matches the merchant's domain exactly", async () => {
        const svc = makeService({ domain: "brand.myshopify.com" });
        const result = await svc.checkAccess(MERCHANT_ID, {
            shopDomains: ["brand.myshopify.com"],
        });
        expect(result).toMatchObject({
            hasAccess: true,
            isOwner: false,
            isAdmin: true,
            role: "admin",
        });
    });

    it("grants access when the merchant domain is a subdomain of the proven shop domain", async () => {
        const svc = makeService({ domain: "shop.brand.com" });
        const result = await svc.checkAccess(MERCHANT_ID, {
            shopDomains: ["brand.com"],
        });
        expect(result.hasAccess).toBe(true);
    });

    it("rejects the reverse direction: a shop cannot vouch for a broader merchant domain", async () => {
        const svc = makeService({ domain: "brand.com" });
        const result = await svc.checkAccess(MERCHANT_ID, {
            shopDomains: ["shop.brand.com"],
        });
        expect(result.hasAccess).toBe(false);
    });

    it("matches via allowedDomains", async () => {
        const svc = makeService({
            domain: "brand.com",
            allowedDomains: ["brand.myshopify.com"],
        });
        const result = await svc.checkAccess(MERCHANT_ID, {
            shopDomains: ["brand.myshopify.com"],
        });
        expect(result.hasAccess).toBe(true);
    });

    it("denies access for an unrelated shop domain", async () => {
        const svc = makeService({ domain: "brand.com" });
        const result = await svc.checkAccess(MERCHANT_ID, {
            shopDomains: ["other.myshopify.com"],
        });
        expect(result.hasAccess).toBe(false);
    });

    it("returns none for an empty identity with no shop domains (no findById call needed)", async () => {
        const svc = makeService();
        const result = await svc.checkAccess(MERCHANT_ID, { shopDomains: [] });
        expect(result).toMatchObject({ hasAccess: false, role: "none" });
    });

    it("includes shop-domain-matched merchants in getAccessibleMerchantIds", async () => {
        const svc = makeService({ domain: "brand.myshopify.com" });
        expect(
            await svc.getAccessibleMerchantIds({
                shopDomains: ["brand.myshopify.com"],
            })
        ).toEqual([MERCHANT_ID]);
    });
});

describe("MerchantAuthorizationService.getAccessibleMerchantIds", () => {
    it("collects merchants owned by wallet", async () => {
        const svc = makeService({ ownerWallet: OWNER });
        expect(await svc.getAccessibleMerchantIds({ wallet: OWNER })).toEqual([
            MERCHANT_ID,
        ]);
    });

    it("collects merchants owned by account (walletless)", async () => {
        const svc = makeService({
            ownerWallet: null,
            ownerAccountId: OWNER_ACCOUNT,
        });
        expect(
            await svc.getAccessibleMerchantIds({
                wallet: null,
                accountId: OWNER_ACCOUNT,
            })
        ).toEqual([MERCHANT_ID]);
    });

    it("dedupes a merchant matched on both axes", async () => {
        const svc = makeService({
            ownerWallet: OWNER,
            ownerAccountId: OWNER_ACCOUNT,
        });
        expect(
            await svc.getAccessibleMerchantIds({
                wallet: OWNER,
                accountId: OWNER_ACCOUNT,
            })
        ).toEqual([MERCHANT_ID]);
    });

    it("returns empty for an empty identity", async () => {
        const svc = makeService();
        expect(
            await svc.getAccessibleMerchantIds({
                wallet: null,
                accountId: null,
            })
        ).toEqual([]);
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
        if (await svc.hasAccess(merchantId, { wallet })) return true;
        if (isSimulatedPlatformAdmin(wallet) && SAFE_METHODS.has(method))
            return true;
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
