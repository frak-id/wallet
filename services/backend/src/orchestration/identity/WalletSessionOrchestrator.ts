import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import type { Address, Hex } from "viem";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type {
    MintForCredentialResult,
    WalletJwtService,
} from "../../domain/auth/services/WalletJwtService";
import type { WebAuthNService } from "../../domain/auth/services/WebAuthNService";
import type { AuthenticatorWalletBindingSelect } from "../../domain/identity/db/schema";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";

type Pubkey = { x: Hex; y: Hex };

/**
 * Deep entry point that turns a freshly-verified WebAuthn credential into a
 * wallet session, folding three concerns that every login/register/sdk
 * handler previously did inline:
 *
 *   1. Resolve the credential's current wallet via the active binding row
 *      on the current chain. Post-merge this is the only correct source —
 *      the deterministic derivation still returns the pre-merge address.
 *   2. Lazy back-fill: when no binding row exists yet (legacy credential),
 *      derive the address from the pubkey and best-effort seed the initial
 *      binding so the next login skips the derivation step.
 *   3. Mint the wallet JWT + SDK companion JWT via the inner
 *      {@link WalletJwtService} primitive.
 *
 * Two entry verbs, one shared invariant:
 *  - {@link sessionForVerifiedCredential} — wallet is unknown; consult the
 *    binding table and fall back to derivation. Used by login/register/sdk.
 *  - {@link mintSessionForExplicitWallet} — wallet is supplied by the
 *    caller (e.g. the wallet-merge orchestrator already knows the winner).
 *    Skips binding consultation and just mints.
 */
export class WalletSessionOrchestrator {
    constructor(
        private readonly walletBindingRepository: WalletBindingRepository,
        private readonly authenticatorRepository: AuthenticatorRepository,
        private readonly webAuthNService: WebAuthNService,
        private readonly walletJwtService: WalletJwtService
    ) {}

    /**
     * Resolve the wallet currently owned by the verified credential and
     * mint a fresh session for it.
     *
     * Failure model:
     *  - `getActiveBinding` throws + `fallbackWallet` supplied → swallow,
     *    use the caller-provided address. Register opts into this so a
     *    transient postgres hiccup never loses a verified passkey.
     *  - `getActiveBinding` throws + no fallback → propagate. Login/SDK
     *    fail closed: silently reviving a stale loser-wallet address after
     *    a merge is the failure mode we're guarding against.
     *  - `seedInitialBinding` errors are ALWAYS swallowed with `log.warn`.
     *    The seed is idempotent via the partial unique index and the next
     *    login will retry — a transient failure must not break the
     *    in-flight ceremony.
     */
    async sessionForVerifiedCredential(params: {
        credentialId: string;
        publicKey: Pubkey;
        transports?: AuthenticatorTransportFuture[];
        fallbackWallet?: Address;
    }): Promise<MintForCredentialResult> {
        const walletAddress = await this.resolveWalletForVerifiedCredential({
            credentialId: params.credentialId,
            publicKey: params.publicKey,
            fallbackWallet: params.fallbackWallet,
        });

        return this.walletJwtService.mintForCredential({
            authenticatorId: params.credentialId,
            walletAddress,
            publicKey: params.publicKey,
            transports: params.transports,
        });
    }

    /**
     * Mint a session for a credential against a caller-supplied wallet
     * address, bypassing the binding table. Used by the wallet-merge
     * orchestrator after a successful settle — the winner address has
     * already been established by the ceremony and consulting the binding
     * table again would either round-trip the same value or race a fresh
     * concurrent merge.
     *
     * Fetches pubkey + transports from the authenticator repository so
     * callers only have to supply the (credentialId, walletAddress) pair.
     */
    async mintSessionForExplicitWallet(params: {
        credentialId: string;
        walletAddress: Address;
    }): Promise<MintForCredentialResult> {
        const credential = await this.authenticatorRepository.getByCredentialId(
            params.credentialId
        );
        if (!credential) {
            throw HttpError.notFound(
                "WALLET_SESSION_CREDENTIAL_NOT_FOUND",
                `No authenticator row for ${params.credentialId}`
            );
        }
        return this.walletJwtService.mintForCredential({
            authenticatorId: params.credentialId,
            walletAddress: params.walletAddress,
            publicKey: credential.publicKey,
            transports: credential.transports,
        });
    }

    /**
     * Wallet-address resolution for a verified credential. Three branches:
     *  - active binding exists → use binding address (post-merge correct).
     *  - active binding lookup throws → see failure model on
     *    {@link sessionForVerifiedCredential}.
     *  - no active binding → derive from pubkey + best-effort seed.
     *
     * Public because callers that need the resolved wallet without minting
     * a session (e.g. `POST /sdk/fromWebAuthNSignature` verifying that a
     * credential resolves to a claimed wallet) share the same invariant.
     */
    async resolveWalletForVerifiedCredential(params: {
        credentialId: string;
        publicKey: Pubkey;
        fallbackWallet?: Address;
    }): Promise<Address> {
        let activeBinding: AuthenticatorWalletBindingSelect | null;
        try {
            activeBinding = await this.walletBindingRepository.getActiveBinding(
                {
                    credentialId: params.credentialId,
                    chainId: currentChainId,
                }
            );
        } catch (error) {
            if (params.fallbackWallet === undefined) {
                // No fallback → propagate. A silent fallback to derivation
                // could revive a stale loser-wallet address after a merge.
                throw error;
            }
            log.warn(
                { err: error, credentialId: params.credentialId },
                "WalletSession: getActiveBinding failed, using caller fallback"
            );
            return params.fallbackWallet;
        }

        if (activeBinding) {
            return activeBinding.smartWalletAddress;
        }

        // No binding row exists yet (legacy credential pre-backfill, or
        // freshly-registered before the seed lands). Derive from the
        // pubkey and best-effort seed so the next login hits the fast
        // path. Seed errors are non-fatal — idempotent retries will catch
        // them on the next login.
        const derived = await this.webAuthNService.getWalletAddress({
            authenticatorId: params.credentialId,
            pubKey: params.publicKey,
        });
        try {
            await this.walletBindingRepository.seedInitialBinding({
                credentialId: params.credentialId,
                chainId: currentChainId,
                smartWalletAddress: derived,
            });
        } catch (error) {
            log.warn(
                error,
                "WalletSession: unable to seed initial binding (will retry next login)"
            );
        }
        return derived;
    }
}
