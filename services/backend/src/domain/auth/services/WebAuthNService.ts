import { viemClient } from "@backend-infrastructure";
import { KernelWallet, kernelAddresses } from "@frak-labs/app-essentials";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { type Signature, WebAuthnP256 } from "ox";
import type { SignMetadata } from "ox/WebAuthnP256";
import { getSenderAddress } from "permissionless/actions";
import {
    type Address,
    concatHex,
    type Hex,
    keccak256,
    stringToHex,
    toHex,
} from "viem";
import { entryPoint06Address } from "viem/account-abstraction";
import type { AuthenticatorRepository } from "../repositories/AuthenticatorRepository";

/**
 * WebAuthn authentication response structure (ox format)
 */
type AuthenticationResponseJSON = {
    id: string;
    response: {
        metadata: SignMetadata;
        signature: Signature.Signature<false>;
    };
};

export class WebAuthNService {
    constructor(
        private readonly authenticatorRepository: AuthenticatorRepository
    ) {}

    /**
     * Parse a compressed webauthn response
     */
    parseCompressedResponse<T>(response: string): T {
        return JSON.parse(Buffer.from(response, "base64").toString("utf-8"));
    }

    /**
     * Get a wallet address from an authenticator
     */
    async getWalletAddress({
        authenticatorId,
        pubKey,
    }: {
        authenticatorId: string;
        pubKey: { x: Hex; y: Hex };
    }) {
        const authenticatorIdHash = keccak256(toHex(authenticatorId));
        const initCode = KernelWallet.getWebAuthNSmartWalletInitCode({
            authenticatorIdHash,
            signerPubKey: pubKey,
        });

        return this.senderAddressFromInitCode(initCode);
    }

    /**
     * Get a wallet address from an authenticator
     */
    async getEcdsaWalletAddress({ ecdsaAddress }: { ecdsaAddress: Address }) {
        const initCode = KernelWallet.getFallbackWalletInitCode({
            ecdsaAddress,
        });

        return this.senderAddressFromInitCode(initCode);
    }

    private senderAddressFromInitCode(initCode: Hex) {
        return getSenderAddress(viemClient, {
            initCode: concatHex([kernelAddresses.factory, initCode]),
            entryPointAddress: entryPoint06Address,
        });
    }

    private buildVerifyInput(
        authenticator: { publicKey: { x: Hex; y: Hex } },
        signature: Signature.Signature<false>,
        metadata: SignMetadata
    ) {
        return {
            publicKey: {
                x: BigInt(authenticator.publicKey.x),
                y: BigInt(authenticator.publicKey.y),
                prefix: 4 as const,
            },
            signature: {
                r: BigInt(signature.r),
                s: BigInt(signature.s),
                yParity: signature.yParity,
            },
            metadata,
        };
    }

    /**
     * Verify a webauthn assertion against the credential the assertion id
     * resolves to. Returns the credential's public key + transports on
     * success; wallet resolution is the caller's responsibility (the active
     * binding lives in the identity domain, and the deterministic
     * derivation via {@link getWalletAddress} is the fallback).
     *
     * Returns `false` for every rejection path (parse failure, unknown
     * credential, signature mismatch) so the caller maps to a single
     * `401 Invalid signature`.
     */
    async isValidSignature({
        compressedSignature,
        challenge,
    }: {
        compressedSignature: string;
        challenge: Hex;
    }): Promise<
        | false
        | {
              authenticatorId: string;
              publicKey: { x: Hex; y: Hex };
              transports?: AuthenticatorTransportFuture[];
          }
    > {
        const result =
            this.parseCompressedResponse<AuthenticationResponseJSON>(
                compressedSignature
            );

        const authenticator =
            await this.authenticatorRepository.getByCredentialId(result.id);
        if (!authenticator) {
            return false;
        }

        const { signature, metadata } = result.response;
        const verification = WebAuthnP256.verify({
            ...this.buildVerifyInput(authenticator, signature, metadata),
            challenge,
        });

        if (!verification) {
            return false;
        }

        return {
            authenticatorId: authenticator._id,
            publicKey: authenticator.publicKey,
            transports: authenticator.transports,
        };
    }

    /**
     * Verify a webauthn assertion produced by the loser side during a wallet
     * merge. The caller passes the candidate challenge strings (current UTC
     * hour ±1h, built via `buildMergeConsentChallengeSlots`); the assertion
     * is accepted if it verifies against any one of them.
     *
     * Returns `false` for every rejection path (parse failure, wrong
     * credential, missing authenticator row, no matching challenge) so the
     * caller can map a single 401 to the user without leaking which sub-check
     * failed.
     */
    async verifyConsentSignature({
        compressedSignature,
        expectedAuthenticatorId,
        expectedChallenges,
    }: {
        compressedSignature: string;
        expectedAuthenticatorId: string;
        expectedChallenges: string[];
    }): Promise<boolean> {
        let result: AuthenticationResponseJSON;
        try {
            result =
                this.parseCompressedResponse<AuthenticationResponseJSON>(
                    compressedSignature
                );
        } catch {
            return false;
        }

        // Bind the assertion to the credential the merge preview pinned down.
        // Without this an attacker holding any valid assertion from any other
        // credential could pass it off as loser consent.
        if (result.id !== expectedAuthenticatorId) {
            return false;
        }

        const authenticator =
            await this.authenticatorRepository.getByCredentialId(result.id);
        if (!authenticator) {
            return false;
        }

        const { signature, metadata } = result.response;
        return expectedChallenges.some((challenge) =>
            WebAuthnP256.verify({
                ...this.buildVerifyInput(authenticator, signature, metadata),
                challenge: stringToHex(challenge),
            })
        );
    }
}
