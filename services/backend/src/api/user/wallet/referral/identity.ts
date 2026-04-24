import type { Address } from "viem";
import { OrchestrationContext } from "../../../../orchestration/context";

/**
 * Resolve the caller's identity group from their wallet session. The wallet
 * is authenticated, so a group is expected to exist (created during register
 * / login). `resolve` is idempotent and creates the group on the rare path
 * where it does not yet exist.
 */
export async function resolveWalletIdentityGroup(
    walletAddress: Address
): Promise<string> {
    const { groupId } =
        await OrchestrationContext.orchestrators.identity.resolve({
            type: "wallet",
            value: walletAddress,
        });
    return groupId;
}
