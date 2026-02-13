import type { Hex } from "viem";
import { keccak256, toHex } from "viem";
import { migrationConfig } from "../config";
import type {
    MigrationAction,
    V1IndexerAdministrator,
    V1IndexerProductInfo,
    V2MerchantInsert,
} from "../types";

export function computeProductId(domain: string): Hex {
    const normalizedDomain = domain.replace("www.", "");
    return keccak256(toHex(normalizedDomain));
}

export function transformProductToMerchant(
    productInfo: V1IndexerProductInfo,
    administrators: V1IndexerAdministrator[]
): { merchant: V2MerchantInsert; actions: MigrationAction[] } {
    const actions: MigrationAction[] = [];

    const owner = administrators.find((admin) => admin.isOwner);
    if (!owner) {
        throw new Error(
            `No owner found for product ${productInfo.product.id} (${productInfo.product.domain})`
        );
    }

    const productId = computeProductId(productInfo.product.domain);
    const primaryBank = productInfo.banks[0];

    const merchant: V2MerchantInsert = {
        productId,
        domain: productInfo.product.domain.replace("www.", ""),
        name: productInfo.product.name,
        ownerWallet: owner.user,
        bankAddress: primaryBank?.id,
        defaultRewardToken: migrationConfig.defaultRewardToken,
        verifiedAt: new Date(
            Number(productInfo.product.createTimestamp) * 1000
        ),
        createdAt: new Date(Number(productInfo.product.createTimestamp) * 1000),
    };

    actions.push({ type: "create_merchant", data: merchant });

    if (!primaryBank) {
        actions.push({
            type: "deploy_bank",
            merchantId: "",
            ownerWallet: owner.user,
        });
    }

    return { merchant, actions };
}

export function formatMerchantForDryRun(merchant: V2MerchantInsert): string {
    return `
  Merchant:
    - Domain: ${merchant.domain}
    - Name: ${merchant.name}
    - Product ID: ${merchant.productId}
    - Owner Wallet: ${merchant.ownerWallet}
    - Bank Address: ${merchant.bankAddress ?? "NEEDS DEPLOYMENT"}
    - Default Reward Token: ${merchant.defaultRewardToken}
`;
}
