import { log } from "@backend-infrastructure";
import { WebAuthN } from "@frak-labs/app-essentials";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import {
    type RegistrationResponseJSON,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { PublicKeyCredential } from "ox/WebAuthnP256";
import { type Address, type Hex, hexToBigInt } from "viem";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type { MintForCredentialResult } from "../../domain/auth/services/WalletJwtService";
import type { WebAuthNService } from "../../domain/auth/services/WebAuthNService";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";
import type { WebAuthNValidatorReader } from "../../infrastructure/blockchain/WebAuthNValidatorReader";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";
import type { WalletSessionOrchestrator } from "./WalletSessionOrchestrator";

type RegistrationInput = {
    /** WebAuthn credential id of the freshly created passkey. */
    id: string;
    /** Public key the client claims for the new passkey. */
    publicKey: { x: Hex; y: Hex; prefix: number };
    /** Compressed WebAuthn registration response (base64 JSON). */
    raw: string;
    userAgent: string;
};

export type RecoveryClaimParams = RegistrationInput & {
    /** Wallet the user just recovered on-chain (from the decrypted blob). */
    recoveredWallet: Address;
    clientId?: string;
};

/**
 * `claimed` carries the minted session; the two failure variants let the
 * route answer with a precise status without leaking orchestration detail.
 */
export type RecoveryClaimResult =
    | { status: "claimed"; session: MintForCredentialResult }
    | { status: "notAuthorized" }
    | { status: "conflict" };

/**
 * Registers a recovery passkey against the wallet it was just added to
 * on-chain — the post-`doAddPasskey` counterpart of the normal register
 * route.
 *
 * Unlike `/auth/register`, the wallet is NOT derived from the new
 * credential (that would resolve to the passkey's own counterfactual
 * wallet, never the recovered one). Instead we trust the chain: the new
 * passkey is only bound to `recoveredWallet` once the validator confirms it
 * is actually registered there with the matching public key. That readback
 * is the whole authorization — a forged `recoveredWallet` can't pass it
 * because the attacker can't add their passkey to a wallet they don't
 * control.
 *
 * On success the credential is bound to the existing wallet (new binding +
 * existing identity group, never a fresh group) and a session for that
 * wallet is minted.
 */
export class RecoveryClaimOrchestrator {
    constructor(
        private readonly authenticatorRepository: AuthenticatorRepository,
        private readonly walletBindingRepository: WalletBindingRepository,
        private readonly webAuthNService: WebAuthNService,
        private readonly webAuthNValidatorReader: WebAuthNValidatorReader,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly walletSessionOrchestrator: WalletSessionOrchestrator
    ) {}

    async claimRecoveredWallet(
        params: RecoveryClaimParams
    ): Promise<RecoveryClaimResult> {
        const { id, publicKey, raw, userAgent, recoveredWallet } = params;

        // 1. The passkey ceremony must be a well-formed registration. The
        // challenge is intentionally not checked (same as /auth/register) —
        // the on-chain readback below is the real authorization gate.
        const registrationResponse =
            this.webAuthNService.parseCompressedResponse<PublicKeyCredential>(
                raw
            );
        const verification = await verifyRegistrationResponse({
            response:
                registrationResponse as unknown as RegistrationResponseJSON,
            expectedChallenge: () => true,
            expectedRPID: WebAuthN.rpAllowedIds,
            expectedOrigin: WebAuthN.rpAllowedOrigins,
        });
        if (!verification.verified || !verification.registrationInfo) {
            log.warn({ recoveredWallet }, "Recovery claim: invalid passkey");
            return { status: "notAuthorized" };
        }

        // 2. Trust the chain, not the client: the new passkey must already be
        // registered on the recovered wallet with the exact public key we're
        // about to store. This is what proves the caller controls the wallet.
        const onChainKey = await this.webAuthNValidatorReader.getPasskey({
            smartWallet: recoveredWallet,
            authenticatorId: id,
        });
        if (
            !onChainKey ||
            onChainKey.x !== hexToBigInt(publicKey.x) ||
            onChainKey.y !== hexToBigInt(publicKey.y)
        ) {
            log.warn(
                { recoveredWallet, credentialId: id },
                "Recovery claim: passkey not registered on-chain for this wallet"
            );
            return { status: "notAuthorized" };
        }

        const { credential, credentialDeviceType, credentialBackedUp } =
            verification.registrationInfo;

        // 3. Persist the credential bound to the RECOVERED wallet.
        const { created, document } =
            await this.authenticatorRepository.createAuthenticator({
                _id: id,
                smartWalletAddress: recoveredWallet,
                userAgent,
                credentialPublicKey: Buffer.from(credential.publicKey).toString(
                    "base64"
                ),
                counter: credential.counter,
                credentialDeviceType,
                credentialBackedUp,
                publicKey,
                transports: credential.transports,
            });

        // Same credential id with a different pubkey is either a real
        // collision or a malicious overwrite attempt — never reuse.
        if (
            !created &&
            (document.publicKey.x !== publicKey.x ||
                document.publicKey.y !== publicKey.y)
        ) {
            log.warn(
                { credentialId: id },
                "Recovery claim: credential id reused with a different public key"
            );
            return { status: "conflict" };
        }

        // 4. Point the credential at the recovered wallet on the active chain
        // (idempotent) and anchor it on the wallet's EXISTING identity group —
        // never a new group, so we don't fork the wallet's identity.
        await this.walletBindingRepository.seedInitialBinding({
            credentialId: id,
            chainId: currentChainId,
            smartWalletAddress: recoveredWallet,
        });
        await this.identityOrchestrator.linkWalletToFingerprint({
            walletAddress: recoveredWallet,
            clientId: params.clientId,
        });

        // 5. Mint a session for the recovered wallet (explicit address,
        // bypassing binding derivation which the seed above just settled).
        const session =
            await this.walletSessionOrchestrator.mintSessionForExplicitWallet({
                credentialId: id,
                walletAddress: recoveredWallet,
            });

        return { status: "claimed", session };
    }
}
