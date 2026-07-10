import { matchesShopDomain } from "@backend-utils";
import { isAddressEqual } from "viem";
import type { MerchantAdminRepository } from "../repositories/MerchantAdminRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";
import type { MerchantIdentity } from "../schemas";

type MerchantRole = "owner" | "admin" | "none";

type MerchantAccess = {
    hasAccess: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    role: MerchantRole;
};

const NO_ACCESS: MerchantAccess = {
    hasAccess: false,
    isOwner: false,
    isAdmin: false,
    role: "none",
};

export class MerchantAuthorizationService {
    constructor(
        private readonly merchantRepository: MerchantRepository,
        private readonly merchantAdminRepository: MerchantAdminRepository
    ) {}

    async checkAccess(
        merchantId: string,
        identity: MerchantIdentity
    ): Promise<MerchantAccess> {
        const { wallet, accountId, shopDomain } = identity;
        if (!wallet && !accountId && !shopDomain) return NO_ACCESS;

        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) return NO_ACCESS;

        const isOwner =
            (wallet &&
                merchant.ownerWallet &&
                isAddressEqual(merchant.ownerWallet, wallet)) ||
            (accountId && merchant.ownerAccountId === accountId);
        if (isOwner) {
            return {
                hasAccess: true,
                isOwner: true,
                isAdmin: false,
                role: "owner",
            };
        }

        const isAdmin = await this.merchantAdminRepository.isAdmin(
            merchantId,
            identity
        );
        if (isAdmin) {
            return {
                hasAccess: true,
                isOwner: false,
                isAdmin: true,
                role: "admin",
            };
        }

        if (this.matchesShopDomain(merchant, shopDomain)) {
            return {
                hasAccess: true,
                isOwner: false,
                isAdmin: true,
                role: "admin",
            };
        }

        return NO_ACCESS;
    }

    /**
     * Shopify SSO auto-link (§4.7): does the account's proven shop domain
     * match this merchant's domain or an allowed domain? Uses the same
     * asymmetric `matchesShopDomain` direction as the registration bypass
     * (§4.10) — the merchant's domain must equal or be a subdomain of the
     * proven shop domain, never the reverse (a shop cannot vouch for a
     * broader domain than itself).
     */
    private matchesShopDomain(
        merchant: { domain: string; allowedDomains: string[] | null },
        shopDomain: string | null | undefined
    ): boolean {
        if (!shopDomain) return false;
        const candidateDomains = [
            merchant.domain,
            ...(merchant.allowedDomains ?? []),
        ];
        return candidateDomains.some((candidate) =>
            matchesShopDomain(candidate, shopDomain)
        );
    }

    async hasAccess(
        merchantId: string,
        identity: MerchantIdentity
    ): Promise<boolean> {
        const access = await this.checkAccess(merchantId, identity);
        return access.hasAccess;
    }

    async hasAccessByDomain(
        merchantId: string,
        shopDomain: string
    ): Promise<boolean> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) return false;
        if (merchant.domain === shopDomain) return true;
        if (merchant.allowedDomains?.includes(shopDomain)) return true;
        return false;
    }

    async getAccessibleMerchantIds(
        identity: MerchantIdentity
    ): Promise<string[]> {
        const { wallet, accountId, shopDomain } = identity;

        const [ownedByWallet, ownedByAccount, adminOf, shopMatched] =
            await Promise.all([
                wallet
                    ? this.merchantRepository.findByOwnerWallet(wallet)
                    : Promise.resolve([]),
                accountId
                    ? this.merchantRepository.findByOwnerAccount(accountId)
                    : Promise.resolve([]),
                this.merchantAdminRepository.findByIdentity(identity),
                shopDomain
                    ? this.getShopDomainMatchedMerchants(shopDomain)
                    : Promise.resolve([]),
            ]);

        const ids = new Set<string>();
        for (const m of ownedByWallet) ids.add(m.id);
        for (const m of ownedByAccount) ids.add(m.id);
        for (const a of adminOf) ids.add(a.merchantId);
        for (const m of shopMatched) ids.add(m.id);
        return [...ids];
    }

    /**
     * Merchants whose `domain`/`allowedDomains` match a proven Shopify shop
     * domain (subdomain-aware). Single source of truth for the §4.7
     * auto-link lookup, shared by `getAccessibleMerchantIds` and
     * `GET /merchant/my` (§2.13).
     *
     * BACKLOG: this scans every merchant (`findAll` + in-app filter) per
     * call — fine at today's merchant volume. When it grows, replace with an
     * indexed SQL query (`domain = $1 OR domain LIKE '%.' || $1`, plus an
     * `unnest(allowed_domains)` match) and drop the full-table scan.
     */
    async getShopDomainMatchedMerchants(
        shopDomain: string
    ): Promise<Awaited<ReturnType<MerchantRepository["findAll"]>>> {
        const all = await this.merchantRepository.findAll();
        return all.filter((merchant) =>
            this.matchesShopDomain(merchant, shopDomain)
        );
    }
}
