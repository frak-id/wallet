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
     * Look up the wallet + active-chain credential currently bound to the
     * given email. Returns `null` when no identity group is attached to the
     * email; returns a partial result when the group exists but the wallet
     * or its current-chain binding is missing (callers should treat both
     * fields as independently optional).
     */
    async findByEmail(email: string): Promise<IdentityWalletLookup | null> {
        const group = await this.identityRepository.findGroupByIdentity({
            type: "email",
            value: email,
        });
        if (!group) return null;
        return this.fromGroupId(group.id);
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
