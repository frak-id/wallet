import type { Address } from "viem";
import type {
    MigrationAction,
    V1IndexerAdministrator,
    V2MerchantAdminInsert,
} from "../types";

const PURCHASE_ORACLE_UPDATER_ROLE = 1n << 3n;

export function transformAdministratorsToMerchantAdmins(
    administrators: V1IndexerAdministrator[],
    merchantId: string,
    ownerWallet: Address
): { admins: V2MerchantAdminInsert[]; actions: MigrationAction[] } {
    const admins: V2MerchantAdminInsert[] = [];
    const actions: MigrationAction[] = [];

    for (const admin of administrators) {
        if (admin.isOwner) continue;

        const rolesMask = BigInt(admin.roles);
        if (rolesMask === PURCHASE_ORACLE_UPDATER_ROLE || rolesMask === 0n)
            continue;

        const merchantAdmin: V2MerchantAdminInsert = {
            merchantId,
            wallet: admin.user,
            addedBy: ownerWallet,
            addedAt: new Date(Number(admin.createdTimestamp) * 1000),
        };

        admins.push(merchantAdmin);
        actions.push({ type: "create_merchant_admin", data: merchantAdmin });
    }

    return { admins, actions };
}

export function formatAdminForDryRun(admin: V2MerchantAdminInsert): string {
    return `
  Merchant Admin:
    - Merchant ID: ${admin.merchantId}
    - Wallet: ${admin.wallet}
    - Added By: ${admin.addedBy}
`;
}
