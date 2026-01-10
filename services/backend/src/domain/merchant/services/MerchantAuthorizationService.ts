import { type Address, isAddressEqual } from "viem";
import type { MerchantAdminRepository } from "../repositories/MerchantAdminRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";

export type MerchantRole = "owner" | "admin" | "none";

export type MerchantAccess = {
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

    async isOwner(merchantId: string, wallet: Address): Promise<boolean> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) {
            return false;
        }
        return isAddressEqual(merchant.ownerWallet, wallet);
    }

    async requireAccess(merchantId: string, wallet: Address): Promise<void> {
        const hasAccess = await this.hasAccess(merchantId, wallet);
        if (!hasAccess) {
            throw new Error("Access denied: not owner or admin of merchant");
        }
    }

    async requireOwner(merchantId: string, wallet: Address): Promise<void> {
        const isOwner = await this.isOwner(merchantId, wallet);
        if (!isOwner) {
            throw new Error("Access denied: not owner of merchant");
        }
    }
}
