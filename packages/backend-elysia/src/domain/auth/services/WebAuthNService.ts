import {
    blockchainContext,
    mongoDbContext,
    sessionContext,
} from "@backend-common";
import { WebAuthN, kernelAddresses } from "@frak-labs/app-essentials";
import {
    type AuthenticationResponseJSON,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { Elysia } from "elysia";
import { getSenderAddress } from "permissionless/actions";
import { type Hex, concatHex, keccak256, toHex } from "viem";
import { entryPoint06Address } from "viem/account-abstraction";
import { AuthenticatorRepository } from "../repositories/AuthenticatorRepository";

export const webAuthNService = new Elysia({ name: "Service.webAuthN" })
    .use(sessionContext)
    .use(blockchainContext)
    .use(mongoDbContext)
    // A few helpers
    .decorate(({ client, getMongoDb, ...decorators }) => {
        const authenticatorRepository = new AuthenticatorRepository(getMongoDb);

        /**
         * Parse a compressed webauthn response
         */
        function parseCompressedWebAuthNResponse<T>(response: string): T {
            return JSON.parse(
                Buffer.from(response, "base64").toString("utf-8")
            );
        }

        /**
         * Get a wallet address from an authenticator
         */
        async function getAuthenticatorWalletAddress({
            authenticatorId,
            pubKey,
        }: { authenticatorId: string; pubKey: { x: Hex; y: Hex } }) {
            // Compute base stuff to fetch the smart wallet address
            const authenticatorIdHash = keccak256(toHex(authenticatorId));
            const initCode = WebAuthN.getWebAuthNSmartWalletInitCode({
                authenticatorIdHash,
                signerPubKey: pubKey,
            });

            // Get the sender address based on the init code
            return getSenderAddress(client, {
                initCode: concatHex([kernelAddresses.factory, initCode]),
                entryPointAddress: entryPoint06Address,
            });
        }

        /**
         * Check if a signature is valid for a given wallet
         */
        async function isValidWebAuthNSignature({
            compressedSignature,
            msg,
        }: {
            compressedSignature: string;
            msg: string;
        }) {
            // Decode the authenticator response
            const signature =
                parseCompressedWebAuthNResponse<AuthenticationResponseJSON>(
                    compressedSignature
                );

            // Find the authenticator
            const authenticator =
                await authenticatorRepository.getByCredentialId(signature.id);
            if (!authenticator) {
                return false;
            }

            // Check if the address match the signature provided
            const walletAddress = await getAuthenticatorWalletAddress({
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
                    publicKey: authenticator.credentialPublicKey.buffer,
                },
                expectedChallenge: msg,
            });
            if (!verification) {
                return false;
            }

            // Update this authenticator counter (if the counter has changed, not the case with touch id)
            if (
                verification.authenticationInfo.newCounter !==
                authenticator.counter
            ) {
                await authenticatorRepository.updateCounter({
                    credentialId: authenticator._id,
                    counter: verification.authenticationInfo.newCounter + 1,
                });
            }

            // All good, return a few info
            return {
                authenticatorId: authenticator._id,
                address: walletAddress,
                publicKey: authenticator.publicKey,
                transports: authenticator.transports,
            };
        }

        return {
            ...decorators,
            isValidWebAuthNSignature,
            parseCompressedWebAuthNResponse,
            authenticatorRepository,
            getAuthenticatorWalletAddress,
        };
    })
    .as("plugin");
