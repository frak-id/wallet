import {
    blockchainContext,
    getMongoDb,
    log,
    sessionContext,
} from "@backend-common";
import { t } from "@backend-utils";
import {
    WebAuthN,
    isRunningLocally,
    kernelAddresses,
} from "@frak-labs/app-essentials";
import {
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
    AuthenticationResponseJSON,
    RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { Elysia } from "elysia";
import { Binary } from "mongodb";
import { getSenderAddress } from "permissionless/actions";
import { type Hex, concatHex, keccak256, toHex } from "viem";
import { entryPoint06Address } from "viem/account-abstraction";
import { AuthenticatorRepository } from "../repositories/AuthenticatorRepository";
import { decodePublicKey } from "../utils/webauthnDecode";

export const walletAuthRoutes = new Elysia({ prefix: "/wallet" })
    .use(blockchainContext)
    .use(sessionContext)
    // Logout
    .post("/logout", async ({ cookie: { walletAuth } }) => {
        walletAuth.remove();
    })
    // Decode token
    .get(
        "/session",
        async ({ cookie: { walletAuth }, walletJwt, error }) => {
            if (!walletAuth.value) {
                return error(404, "No wallet session found");
            }

            // Decode it
            const decodedSession = await walletJwt.verify(walletAuth.value);
            if (!decodedSession) {
                console.log("Error decoding session", { decodedSession });
                return error(404, "Invalid wallet session");
            }
            return decodedSession;
        },
        {
            response: {
                404: t.String(),
                200: t.Object({
                    address: t.Address(),
                    authenticatorId: t.String(),
                    publicKey: t.Object({
                        x: t.Hex(),
                        y: t.Hex(),
                    }),
                }),
            },
        }
    )
    // A few helpers for login + registration
    .decorate(({ client, ...decorators }) => ({
        // Helper function to get a wallet address from an authenticator
        async getAuthenticatorWalletAddress({
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
        },
        // Authenticator repository access
        getAuthenticatorDb: getMongoDb({
            urlKey: "MONGODB_NEXUS_URI",
            db: "nexus",
        }).then((db) => new AuthenticatorRepository(db)),
        ...decorators,
    }))
    // Login
    .post(
        "/login",
        async ({
            getAuthenticatorDb,
            walletJwt,
            error,
            body: {
                authenticatorResponse: rawAuthenticatorResponse,
                expectedChallenge,
            },
            cookie: { walletAuth },
            getAuthenticatorWalletAddress,
        }) => {
            // Decode the authenticator response
            const authenticationResponse = JSON.parse(
                Buffer.from(rawAuthenticatorResponse, "base64").toString()
            ) as AuthenticationResponseJSON;

            // Try to find the authenticator for this user
            const authenticatorDbRepository = await getAuthenticatorDb;
            const authenticator =
                await authenticatorDbRepository.getByCredentialId(
                    authenticationResponse.id
                );
            if (!authenticator) {
                log.warn(
                    { id: authenticationResponse.id },
                    "Trying to login with an unknown authenticator id"
                );
                return error(404, "No authenticator found for this id");
            }

            // Find a challenges in the user matching the one performed
            const verification = await verifyAuthenticationResponse({
                response: authenticationResponse,
                expectedOrigin: WebAuthN.rpOrigin,
                expectedRPID: WebAuthN.rpId,
                authenticator: {
                    counter: authenticator.counter,
                    credentialID: authenticator._id,
                    // todo: Auto mapping of string to Uint8Array
                    credentialPublicKey:
                        authenticator.credentialPublicKey.buffer,
                },
                expectedChallenge,
            });
            if (!verification) {
                return error(404, "Verification failed");
            }

            // Update this authenticator counter (if the counter has changed, not the case with touch id)
            if (
                verification.authenticationInfo.newCounter !==
                authenticator.counter
            ) {
                await authenticatorDbRepository.updateCounter({
                    credentialId: authenticator._id,
                    counter: verification.authenticationInfo.newCounter + 1,
                });
            }

            // Get the wallet address
            const walletAddress = await getAuthenticatorWalletAddress({
                authenticatorId: authenticator._id,
                pubKey: authenticator.publicKey,
            });

            // If the wallet didn't have any predicated smart wallet address, set it
            if (authenticator.smartWalletAddress === undefined) {
                await authenticatorDbRepository.updateSmartWalletAddress({
                    credentialId: authenticator._id,
                    smartWalletAddress: walletAddress,
                });
            }

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                address: walletAddress,
                authenticatorId: authenticator._id,
                publicKey: authenticator.publicKey,
                sub: walletAddress,
                iat: Date.now(),
            });
            console.log("Setting cookie", { token });
            walletAuth.set({
                value: token,
                sameSite: "none",
                maxAge: 60 * 60 * 24 * 7, // 1 week
                secure: true,
                domain: isRunningLocally ? "localhost" : ".frak.id",
            });

            return {
                address: walletAddress,
                authenticatorId: authenticator._id,
                publicKey: authenticator.publicKey,
            };
        },
        {
            body: t.Object({
                // Challenge should be on the backend side
                expectedChallenge: t.String(),
                // b64 + stringified version of the authenticator response
                authenticatorResponse: t.String(),
            }),
            response: {
                404: t.String(),
                200: t.Object({
                    address: t.Address(),
                    authenticatorId: t.String(),
                    publicKey: t.Object({
                        x: t.Hex(),
                        y: t.Hex(),
                    }),
                }),
            },
        }
    )
    // Registration
    .post(
        "/register",
        async ({
            getAuthenticatorDb,
            walletJwt,
            error,
            body: {
                registrationResponse: rawRegistrationResponse,
                expectedChallenge,
                userAgent,
                setSessionCookie,
                previousWallet,
            },
            cookie: { walletAuth },
            getAuthenticatorWalletAddress,
        }) => {
            // Decode the registration response
            const registrationResponse = JSON.parse(
                Buffer.from(rawRegistrationResponse, "base64").toString()
            ) as RegistrationResponseJSON;

            // Verify the registration response
            const verification = await verifyRegistrationResponse({
                response: registrationResponse,
                expectedChallenge,
                expectedOrigin: WebAuthN.rpOrigin,
                expectedRPID: WebAuthN.rpId,
            });
            if (!verification.registrationInfo) {
                log.error(
                    {
                        verification,
                        expectedChallenge,
                        response: registrationResponse,
                        rpOrigin: WebAuthN.rpOrigin,
                        rpId: WebAuthN.rpId,
                    },
                    "Registration of a new authenticator failed"
                );
                return error(400, "Registration failed");
            }

            // Get the public key
            const publicKey = decodePublicKey({
                credentialPubKey:
                    verification.registrationInfo.credentialPublicKey,
            });

            // Extract the info we want to store
            const {
                credentialPublicKey,
                credentialID,
                counter,
                credentialDeviceType,
                credentialBackedUp,
            } = verification.registrationInfo;

            // Get the wallet address
            const walletAddress =
                previousWallet ??
                (await getAuthenticatorWalletAddress({
                    authenticatorId: credentialID,
                    pubKey: publicKey,
                }));
            const authenticatorDbRepository = await getAuthenticatorDb;
            await authenticatorDbRepository.createAuthenticator({
                _id: credentialID,
                smartWalletAddress: walletAddress,
                userAgent,
                credentialPublicKey: new Binary(credentialPublicKey),
                counter,
                credentialDeviceType,
                credentialBackedUp,
                publicKey,
                transports: registrationResponse.response.transports,
            });

            // If we don't want to set the session cookie, return the wallet
            if (!setSessionCookie) {
                log.debug(
                    { walletAddress },
                    "Skipping session cookie registration"
                );
                return {
                    address: walletAddress,
                    authenticatorId: credentialID,
                    publicKey,
                };
            }

            // Create the token and set the cookie
            const token = await walletJwt.sign({
                address: walletAddress,
                authenticatorId: credentialID,
                publicKey: publicKey,
                sub: walletAddress,
                iat: Date.now(),
            });
            walletAuth.set({
                value: token,
                sameSite: "none",
                maxAge: 60 * 60 * 24 * 7, // 1 week
                secure: true,
                domain: isRunningLocally ? "localhost" : ".frak.id",
            });

            return {
                address: walletAddress,
                authenticatorId: credentialID,
                publicKey,
            };
        },
        {
            body: t.Object({
                // Challenge should be on the backend side
                expectedChallenge: t.String(),
                // b64 + stringified version of the registration response
                registrationResponse: t.String(),
                userAgent: t.String(),
                previousWallet: t.Optional(t.Address()),
                setSessionCookie: t.Optional(t.Boolean()),
            }),
            response: {
                400: t.String(),
                200: t.Object({
                    address: t.Address(),
                    authenticatorId: t.String(),
                    publicKey: t.Object({
                        x: t.Hex(),
                        y: t.Hex(),
                    }),
                }),
            },
        }
    );
