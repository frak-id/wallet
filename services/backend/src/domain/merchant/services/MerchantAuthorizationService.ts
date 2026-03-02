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

export class MerchantAuthorizationService {
    constructor(
        private readonly merchantRepository: MerchantRepository,
        private readonly merchantAdminRepository: MerchantAdminRepository
    ) {}

    async checkAccess(
        merchantId: string,
        wallet: Address
    ): Promise<MerchantAccess> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) {
            return {
                hasAccess: false,
                isOwner: false,
                isAdmin: false,
                role: "none",
            };
        }

        const isOwner = isAddressEqual(merchant.ownerWallet, wallet);
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
            wallet
        );
        if (isAdmin) {
            return {
                hasAccess: true,
                isOwner: false,
                isAdmin: true,
                role: "admin",
            };
        }

        return {
            hasAccess: false,
            isOwner: false,
            isAdmin: false,
            role: "none",
        };
    }

    async hasAccess(merchantId: string, wallet: Address): Promise<boolean> {
        const access = await this.checkAccess(merchantId, wallet);
        return access.hasAccess;
    }

    async hasAccessByDomain(
        merchantId: string,
        shopDomain: string
    ): Promise<boolean> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) return false;
        return merchant.domain === shopDomain;
    }

    async getAccessibleMerchantIds(wallet: Address): Promise<string[]> {
        const [owned, adminOf] = await Promise.all([
            this.merchantRepository.findByOwnerWallet(wallet),
            this.merchantAdminRepository.findByWallet(wallet),
        ]);

        const ids = new Set<string>();
        for (const m of owned) ids.add(m.id);
        for (const a of adminOf) ids.add(a.merchantId);
        return [...ids];
    }
}
