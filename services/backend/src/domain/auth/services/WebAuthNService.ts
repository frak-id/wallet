import { viemClient } from "@backend-common";
import { KernelWallet, kernelAddresses } from "@frak-labs/app-essentials";
import { type Signature, WebAuthnP256 } from "ox";
import type { SignMetadata } from "ox/WebAuthnP256";
import { getSenderAddress } from "permissionless/actions";
import { type Address, concatHex, type Hex, keccak256, toHex } from "viem";
import { entryPoint06Address } from "viem/account-abstraction";
import type { AuthenticatorRepository } from "../repositories/AuthenticatorRepository";

/**
 * WebAuthn authentication response structure (simplified ox format)
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
     * Check if a signature is valid for a given wallet
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
            this.parseCompressedResponse<AuthenticationResponseJSON>(
                compressedSignature
            );

        // Find the authenticator
        const authenticator =
            await this.authenticatorRepository.getByCredentialId(result.id);
        if (!authenticator) {
            return false;
        }

        // Check if the address match the signature provided
        const walletAddress = await this.getWalletAddress({
            authenticatorId: result.id,
            pubKey: authenticator.publicKey,
        });

        // Ensure the verification pass using ox
        const { signature, metadata } = result.response;
        const verification = WebAuthnP256.verify({
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
