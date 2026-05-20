import { currentChainId } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";

/**
 * Resolution of a wallet + its current-chain credential from an identity
 * input (today: an email). Returned shape is shared by:
 *  - `POST /user/wallet/auth/email` conflict branch — when a user types an
 *    email already attached to another wallet.
 *  - `POST /user/wallet/auth/emailStatus` — pre-registration check used by
 *    the UI to short-circuit the WebAuthn ceremony.
 *
 * `wallet` is omitted when the resolved identity group has no active wallet
 * node (anonymous-only group). `authenticatorId` is omitted when the wallet
 * has no active binding on the current chain (e.g. cross-env account).
 */
export type IdentityWalletLookup = {
    groupId: string;
    wallet?: Address;
    authenticatorId?: string;
};

/**
 * Cross-domain helper that resolves identity-graph nodes (postgres) to the
 * libSQL credential currently bound to the underlying wallet. Lives in
 * `orchestration/identity/` for the same reason as {@link WalletMergeOrchestrator}:
 * the read path crosses the identity ↔ auth boundary.
 */
export class AuthenticatorLookupOrchestrator {
    constructor(
        private readonly authenticatorRepository: AuthenticatorRepository,
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
        const authenticator = wallet
            ? await this.authenticatorRepository.getByActiveWallet({
                  chainId: currentChainId,
                  smartWalletAddress: wallet,
              })
            : null;
        return {
            groupId,
            wallet: wallet ?? undefined,
            authenticatorId: authenticator?._id,
        };
    }
}
