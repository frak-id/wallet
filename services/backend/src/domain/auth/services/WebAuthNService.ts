import { log, viemClient } from "@backend-infrastructure";
import {
    KernelWallet,
    kernelAddresses,
    WebAuthN,
} from "@frak-labs/app-essentials";
import {
    type AuthenticationResponseJSON,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { WebAuthnP256 } from "ox";
import { getSenderAddress } from "permissionless/actions";
import { type Address, concatHex, type Hex, keccak256, toHex } from "viem";
import { entryPoint06Address } from "viem/account-abstraction";
import type { AuthenticatorRepository } from "../repositories/AuthenticatorRepository";

/**
 * Parsed WebAuthn response structure (supports both ox and simplewebauthn formats)
 */
type ParsedWebAuthnResponse = {
    id: string;
    rawId?: string;
    response: {
        // Android Tauri / simplewebauthn format
        authenticatorData?: string;
        clientDataJSON?: string;
        signature?: string | { r: bigint; s: bigint; yParity?: number };
        // Web/iOS ox format
        metadata?: {
            authenticatorData: `0x${string}`;
            challengeIndex: number;
            clientDataJSON: string;
            typeIndex: number;
            userVerificationRequired: boolean;
        };
    };
    type?: string;
    extensions?: Record<string, unknown>;
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
        // Compute base stuff to fetch the smart wallet address
        const authenticatorIdHash = keccak256(toHex(authenticatorId));
        const initCode = KernelWallet.getWebAuthNSmartWalletInitCode({
            authenticatorIdHash,
            signerPubKey: pubKey,
        });

        // Get the sender address based on the init code
        return getSenderAddress(viemClient, {
            initCode: concatHex([kernelAddresses.factory, initCode]),
            entryPointAddress: entryPoint06Address,
        });
    }

    /**
     * Get a wallet address from an authenticator
     */
    async getEcdsaWalletAddress({ ecdsaAddress }: { ecdsaAddress: Address }) {
        // Compute base stuff to fetch the smart wallet address
        const initCode = KernelWallet.getFallbackWalletInitCode({
            ecdsaAddress,
        });

        // Get the sender address based on the init code
        return getSenderAddress(viemClient, {
            initCode: concatHex([kernelAddresses.factory, initCode]),
            entryPointAddress: entryPoint06Address,
        });
    }

    /**
     * Verify Android Tauri WebAuthn signature using simplewebauthn library
     * @private
     */
    private async verifyAndroidTauriSignature({
        result,
        challenge,
        authenticator,
    }: {
        result: ParsedWebAuthnResponse;
        challenge: Hex;
        authenticator: {
            credentialPublicKey: { buffer: unknown };
            counter: number;
        };
    }): Promise<boolean> {
        // Convert hex challenge to base64url (frontend sends hex, webauthn uses base64url)
        const challengeHex = challenge.startsWith("0x")
            ? challenge.slice(2)
            : challenge;
        const challengeBytes = Buffer.from(challengeHex, "hex");
        const challengeBase64url = challengeBytes
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        log.info(
            {
                challengeHex: challenge,
                challengeBase64url,
                rpAllowedOrigins: WebAuthN.rpAllowedOrigins,
                rpAllowedIds: WebAuthN.rpAllowedIds,
            },
            "[WebAuthN] Android login verification starting"
        );

        try {
            // Ensure credential public key is a Uint8Array
            const buffer = authenticator.credentialPublicKey.buffer;
            const credentialPublicKey =
                buffer instanceof Uint8Array
                    ? buffer
                    : buffer instanceof ArrayBuffer
                      ? new Uint8Array(buffer)
                      : new Uint8Array(buffer as ArrayBuffer);

            log.info(
                {
                    credentialID: result.id,
                    credentialPublicKeyLength: credentialPublicKey.length,
                    counter: authenticator.counter,
                },
                "[WebAuthN] Verification inputs"
            );

            const verificationResult = await verifyAuthenticationResponse({
                response: result as AuthenticationResponseJSON,
                expectedChallenge: challengeBase64url,
                expectedRPID: WebAuthN.rpAllowedIds,
                expectedOrigin: WebAuthN.rpAllowedOrigins,
                // simplewebauthn v10+ uses 'credential' instead of 'authenticator'
                credential: {
                    id: result.id, // Base64URL string
                    publicKey: credentialPublicKey as Uint8Array<ArrayBuffer>,
                    counter: authenticator.counter,
                },
            });
            log.info(
                { verified: verificationResult.verified },
                "[WebAuthN] Verification result"
            );
            return verificationResult.verified;
        } catch (verifyError) {
            const errorMessage =
                verifyError instanceof Error
                    ? verifyError.message
                    : String(verifyError);
            const errorStack =
                verifyError instanceof Error ? verifyError.stack : undefined;
            log.error(
                { errorMessage, errorStack },
                "[WebAuthN] Verification error"
            );
            return false;
        }
    }

    /**
     * Check if a signature is valid for a given wallet
     * Supports both ox format (web/iOS) and simplewebauthn format (Android Tauri)
     */
    async isValidSignature({
        compressedSignature,
        challenge,
    }: {
        compressedSignature: string;
        challenge: Hex;
    }) {
        // Decode the authenticator response
        const result =
            this.parseCompressedResponse<ParsedWebAuthnResponse>(
                compressedSignature
            );

        log.info(
            {
                resultId: result.id,
                resultKeys: Object.keys(result),
                responseKeys: result.response
                    ? Object.keys(result.response)
                    : null,
            },
            "[WebAuthN] Parsed response"
        );

        // Find the authenticator
        const authenticator =
            await this.authenticatorRepository.getByCredentialId(result.id);
        if (!authenticator) {
            log.warn(
                { resultId: result.id },
                "[WebAuthN] Authenticator not found"
            );
            return false;
        }

        // Check if the address match the signature provided
        const walletAddress = await this.getWalletAddress({
            authenticatorId: result.id,
            pubKey: authenticator.publicKey,
        });

        // Detect format: simplewebauthn has authenticatorData/clientDataJSON/signature as base64url strings
        const isSimpleWebAuthnFormat =
            typeof result.response?.authenticatorData === "string" &&
            typeof result.response?.clientDataJSON === "string" &&
            typeof result.response?.signature === "string";

        log.info({ isSimpleWebAuthnFormat }, "[WebAuthN] Format detection");

        let verification = false;

        if (isSimpleWebAuthnFormat) {
            // Android Tauri format - use simplewebauthn verification
            verification = await this.verifyAndroidTauriSignature({
                result,
                challenge,
                authenticator,
            });
        } else {
            // Web/iOS ox format - use ox verification
            const { signature, metadata } = result.response;
            if (
                !metadata ||
                !signature ||
                typeof signature === "string" ||
                !("r" in signature)
            ) {
                return false;
            }

            verification = WebAuthnP256.verify({
                publicKey: {
                    x: BigInt(authenticator.publicKey.x),
                    y: BigInt(authenticator.publicKey.y),
                    prefix: 4,
                },
                signature: {
                    r: BigInt(signature.r),
                    s: BigInt(signature.s),
                    yParity: signature.yParity,
                },
                metadata,
                challenge,
            });
        }

        if (!verification) {
            return false;
        }

        // All good, return a few info
        return {
            authenticatorId: authenticator._id,
            address: walletAddress,
            publicKey: authenticator.publicKey,
            rawPublicKey: authenticator.credentialPublicKey.buffer,
            transports: authenticator.transports,
        };
    }
}
