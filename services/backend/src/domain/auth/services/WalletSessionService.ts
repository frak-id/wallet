import { JwtContext } from "@backend-infrastructure";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import type { Address, Hex } from "viem";
import type { WalletSdkSessionService } from "./WalletSdkSessionService";

type MintForCredentialArgs = {
    /** WebAuthn credential id of the passkey the user is authenticating with. */
    authenticatorId: string;
    /**
     * Smart-wallet address the freshly minted session should resolve to. May
     * differ from the credential's deterministically-derived address — for
     * example after a wallet merge has repointed the credential's binding
     * to a different (winner) wallet.
     */
    walletAddress: Address;
    publicKey: { x: Hex; y: Hex };
    transports?: AuthenticatorTransportFuture[];
};

type MintForCredentialResult = {
    token: string;
    sdkJwt: { token: string; expires: number };
    type: "webauthn";
    address: Address;
    authenticatorId: string;
    publicKey: { x: Hex; y: Hex };
    transports?: AuthenticatorTransportFuture[];
};

/**
 * Mints webauthn wallet-session JWTs for a credential ↔ wallet pair.
 *
 * Two call sites:
 *  1. `POST /user/wallet/auth/login` — after verifying a fresh biometric
 *     assertion against the credential's pubkey.
 *  2. `WalletMergeOrchestrator.settle` — after a successful merge, when the
 *     requester authenticated with the loser credential and the on-chain
 *     `addPassKey` userOp + loser-consent assertion have both been
 *     verified. The merge ceremony itself constitutes the proof of
 *     credential ownership, so we mint without forcing a separate
 *     re-login round-trip.
 *
 * Centralising the mint here keeps both routes in lockstep with the
 * `WalletAuthResponseDto` shape and ensures the SDK companion JWT is
 * always generated alongside the wallet JWT.
 */
export class WalletSessionService {
    constructor(private readonly sdkSessionService: WalletSdkSessionService) {}

    async mintForCredential({
        authenticatorId,
        walletAddress,
        publicKey,
        transports,
    }: MintForCredentialArgs): Promise<MintForCredentialResult> {
        const token = await JwtContext.wallet.sign({
            type: "webauthn",
            address: walletAddress,
            authenticatorId,
            publicKey,
            transports,
            sub: walletAddress,
            iat: Date.now(),
        });

        const sdkJwt = await this.sdkSessionService.generateSdkJwt({
            wallet: walletAddress,
        });

        return {
            token,
            sdkJwt,
            type: "webauthn",
            address: walletAddress,
            authenticatorId,
            publicKey,
            transports,
        };
    }
}
