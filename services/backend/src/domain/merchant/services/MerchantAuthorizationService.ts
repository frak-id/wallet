import { type Address, isAddressEqual } from "viem";
import type { MerchantAdminRepository } from "../repositories/MerchantAdminRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";

type MerchantRole = "owner" | "admin" | "none";

type MerchantAccess = {
    hasAccess: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    role: MerchantRole;
};

/**
 * Caller identity for merchant authorization. Wallet-only (legacy JWT
 * sessions), account-only (walletless accounts) and dual (wallet-linked
 * accounts) are all valid shapes; a match on either axis grants access.
 */
export type MerchantIdentity = {
    wallet?: Address | null;
    accountId?: string | null;
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
        const { wallet, accountId } = identity;
        if (!wallet && !accountId) return NO_ACCESS;

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

        return NO_ACCESS;
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
        const { wallet, accountId } = identity;

        const [ownedByWallet, ownedByAccount, adminOf] = await Promise.all([
            wallet
                ? this.merchantRepository.findByOwnerWallet(wallet)
                : Promise.resolve([]),
            accountId
                ? this.merchantRepository.findByOwnerAccount(accountId)
                : Promise.resolve([]),
            this.merchantAdminRepository.findByIdentity(identity),
        ]);

        const ids = new Set<string>();
        for (const m of ownedByWallet) ids.add(m.id);
        for (const m of ownedByAccount) ids.add(m.id);
        for (const a of adminOf) ids.add(a.merchantId);
        return [...ids];
    }
}
