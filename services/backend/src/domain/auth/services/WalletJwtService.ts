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

export type MintForCredentialResult = {
    token: string;
    sdkJwt: { token: string; expires: number };
    type: "webauthn";
    address: Address;
    authenticatorId: string;
    publicKey: { x: Hex; y: Hex };
    transports?: AuthenticatorTransportFuture[];
};

/**
 * Pure JWT-mint primitive for a `(credential, wallet)` pair. Owns the
 * wallet-JWT + SDK-companion-JWT pairing and the `WalletAuthResponseDto`
 * shape, nothing else.
 *
 * Wallet resolution (current-chain binding lookup, derivation fallback,
 * lazy back-fill) lives one layer up in `WalletSessionOrchestrator`, which
 * is the entry point every API handler should call. This service is the
 * orchestrator's inner mint primitive — direct callers should be rare.
 */
export class WalletJwtService {
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
