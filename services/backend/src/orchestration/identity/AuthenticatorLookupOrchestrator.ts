import { currentChainId } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";

/**
 * Resolution of a wallet + its current-chain credentials from an identity
 * input (today: an email). Returned shape is shared by:
 *  - `POST /user/wallet/auth/email` conflict branch — when a user types an
 *    email already attached to another wallet.
 *  - `POST /user/wallet/auth/emailStatus` — pre-registration check used by
 *    the UI to short-circuit the WebAuthn ceremony.
 *
 * `wallet` is omitted when the resolved identity group has no active wallet
 * node (anonymous-only group). `authenticatorIds` is an empty array when the
 * wallet has no active binding on the current chain (e.g. cross-env
 * account); it holds every active binding so the WebAuthn ceremony can offer
 * the user any passkey currently routed to the wallet — post-merge a wallet
 * routinely accepts 2+ credentials.
 */
export type IdentityWalletLookup = {
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
 * Cross-domain helper that resolves identity-graph nodes (postgres) to the
 * credential currently bound to the underlying wallet (postgres binding
 * table → libSQL credential row). Both reads are postgres-only now, but
 * the orchestrator placement is kept since the surrounding flow still
 * spans the identity ↔ auth boundary.
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
