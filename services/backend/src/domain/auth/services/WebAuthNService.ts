import { viemClient } from "@backend-common";
import {
    KernelWallet,
    WebAuthN,
    kernelAddresses,
} from "@frak-labs/app-essentials";
import {
    type AuthenticationResponseJSON,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { getSenderAddress } from "permissionless/actions";
import { type Address, type Hex, concatHex, keccak256, toHex } from "viem";
import { entryPoint06Address } from "viem/account-abstraction";
import type { AuthenticatorRepository } from "../repositories/AuthenticatorRepository";
import { decodePublicKey } from "../utils/webauthnDecode";

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
    }: { authenticatorId: string; pubKey: { x: Hex; y: Hex } }) {
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
        msg,
    }: {
        compressedSignature: string;
        msg: string;
    }) {
        // Decode the authenticator response
        const signature =
            this.parseCompressedResponse<AuthenticationResponseJSON>(
                compressedSignature
            );

        // Find the authenticator
        const authenticator =
            await this.authenticatorRepository.getByCredentialId(signature.id);
        if (!authenticator) {
            return false;
        }

        // Check if the address match the signature provided
        const walletAddress = await this.getWalletAddress({
            authenticatorId: signature.id,
            pubKey: authenticator.publicKey,
        });

        // Ensure the verification pass
        const verification = await verifyAuthenticationResponse({
            response: signature,
            expectedOrigin: WebAuthN.rpOrigin,
            expectedRPID: WebAuthN.rpId,
            credential: {
                counter: authenticator.counter,
                id: authenticator._id,
                publicKey: authenticator.credentialPublicKey
                    .buffer as Uint8Array<ArrayBuffer>,
            },
            expectedChallenge: msg,
        });
        if (!verification) {
            return false;
        }

        // Update this authenticator counter (if the counter has changed, not the case with touch id)
        if (
            verification.authenticationInfo.newCounter !== authenticator.counter
        ) {
            await this.authenticatorRepository.updateCounter({
                credentialId: authenticator._id,
                counter: verification.authenticationInfo.newCounter + 1,
            });
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

    get decodePublicKey() {
        return decodePublicKey;
    }
}
