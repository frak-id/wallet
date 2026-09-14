import { currentChainId } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";

/**
 * `wallet` is omitted for an anonymous-only group. `authenticatorIds` holds
 * every active binding on the current chain (empty for a cross-env account),
 * since post-merge a wallet routinely accepts 2+ credentials.
 */
type IdentityWalletLookup = {
    groupId: string;
    wallet?: Address;
    authenticatorIds: string[];
};

/**
 * Availability of an email address relative to an optional caller group:
 *  - `available`: free to use, or already the caller's own active address.
 *  - `merge`: actively owned by another group → the client routes into the
 *    login / merge flow using the surfaced wallet + credentials.
 *  - `unavailable`: present but retired (unlinked) anywhere → globally
 *    non-reusable for now (the unlinked row still holds the unique slot).
 */
export type EmailResolution =
    | { status: "available" }
    | { status: "merge"; wallet?: Address; authenticatorIds: string[] }
    | { status: "unavailable" };

/**
 * Resolves identity-graph nodes to the credentials bound to the underlying
 * wallet — spans the identity ↔ auth boundary.
 */
export class AuthenticatorLookupOrchestrator {
    constructor(
        private readonly walletBindingRepository: WalletBindingRepository,
        private readonly identityRepository: IdentityRepository
    ) {}

    /**
     * Classify an email address for the auth + email-management flows: free,
     * actively owned by another group (merge target), or retired and thus
     * non-reusable. `currentGroupId` (when known) marks the caller's own
     * active address as `available` rather than a self-conflict.
     */
    async resolveEmail(
        email: string,
        currentGroupId?: string
    ): Promise<EmailResolution> {
        const node = await this.identityRepository.findEmailNode(email);
        if (!node) {
            return { status: "available" };
        }
        if (node.groupId === currentGroupId && !node.unlinkedAt) {
            return { status: "available" };
        }
        if (!node.unlinkedAt) {
            const { wallet, authenticatorIds } = await this.fromGroupId(
                node.groupId
            );
            return { status: "merge", wallet, authenticatorIds };
        }
        return { status: "unavailable" };
    }

    private async fromGroupId(groupId: string): Promise<IdentityWalletLookup> {
        const wallet = await this.identityRepository.getWalletForGroup(groupId);
        const authenticatorIds = wallet
            ? await this.walletBindingRepository.getActiveAuthenticatorIdsByWallet(
                  {
                      chainId: currentChainId,
                      smartWalletAddress: wallet,
                  }
              )
            : [];
        return {
            groupId,
            wallet: wallet ?? undefined,
            authenticatorIds,
        };
    }
}
