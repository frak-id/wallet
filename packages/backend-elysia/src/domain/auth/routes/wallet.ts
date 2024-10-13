import { nextSessionContext, sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { WebAuthN, isRunningLocally } from "@frak-labs/app-essentials";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { Elysia } from "elysia";
import { zeroAddress } from "viem";
import { authContext } from "../context";

export const walletAuthRoutes = new Elysia({ prefix: "/wallet" })
    .use(authContext)
    .use(nextSessionContext)
    .use(sessionContext)
    // todo: wallet auth endpoint
    .post(
        "/sign",
        async ({
            authenticatorDbRepository,
            walletJwt,
            error,
            body: {
                authenticatorResponse: rawAuthenticatorResponse,
                expectedChallenge,
            },
            cookie: { walletAuth },
        }) => {
            // Decode the authenticator response
            const authenticationResponse = JSON.parse(
                Buffer.from(rawAuthenticatorResponse, "base64").toString()
            ) as AuthenticationResponseJSON;

            // Try to find the authenticator for this user
            const authenticator =
                await authenticatorDbRepository.getByCredentialId(
                    authenticationResponse.id
                );
            if (!authenticator) {
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
                    credentialPublicKey: authenticator.credentialPublicKey,
                },
                expectedChallenge,
            });

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

            // todo: smart wallet prediction
            // todo: for address prediction we need init code + getsenderAddress from pimlico
            // todo: Maybe this should stay on the wallet side???

            // todo: Generate auth cookie plus set it
            // todo: endpoint to get session informations

            const token = walletJwt.sign({
                address: zeroAddress,
                authenticatorId: authenticator._id,
                publicKey: authenticator.publicKey,
                iss: "frak.id",
                sub: zeroAddress,
                iat: Date.now(),
                // Expire in a week
                exp: Date.now() + 60_000 * 60 * 24 * 7,
            });
            walletAuth.set({
                value: token,
                sameSite: "none",
                maxAge: 60 * 60 * 24 * 7, // 1 week
                secure: true,
                domain: isRunningLocally ? "localhost" : ".frak.id",
            });
        },
        {
            body: t.Object({
                // Challenge should be on the backend side
                expectedChallenge: t.String(),
                // b64 + stringified version of the authenticator response
                authenticatorResponse: t.String(),
            }),
        }
    );
