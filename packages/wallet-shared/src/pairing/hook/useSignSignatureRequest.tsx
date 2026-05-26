import { WebAuthN } from "@frak-labs/app-essentials";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { useCallback } from "react";
import { useStore } from "zustand";
import { getTauriGetFn } from "../../authentication";
import { selectWebauthnSession, sessionStore } from "../../stores/sessionStore";
import { signHashViaWebAuthN } from "../../wallet/smartWallet/signature";
import type { TargetPairingClient } from "../clients/target";
import { pairingKey } from "../queryKeys";
import type { TargetPairingPendingSignature } from "../types";

/**
 * Hooks used to sign a signature request
 */
export function useSignSignatureRequest({
    client,
}: {
    client: TargetPairingClient;
}) {
    const session = useStore(sessionStore, selectWebauthnSession);

    return useMutation({
        mutationKey: pairingKey.target.handleSignatureRequest(session?.address),
        mutationFn: async (request: TargetPairingPendingSignature) => {
            // If no session, throw
            if (!session) {
                throw new Error("No session found");
            }

            // Try to sign it, otherwise, reject it
            try {
                // `raw-assertion` is the cross-device merge consent flow:
                // the paired peer (target) signs the deterministic merge-
                // consent challenge with its OWN passkey and returns a
                // base64 WebAuthn assertion JSON parseable by the backend's
                // `verifyConsentSignature`. No on-chain wrapping — the
                // origin just forwards the string to `POST /merge/settle`.
                if (request.signatureKind === "raw-assertion") {
                    const tauriGetFn = getTauriGetFn();
                    const { metadata, signature, raw } =
                        await WebAuthnP256.sign({
                            credentialId: session.authenticatorId,
                            rpId: WebAuthN.rpId,
                            userVerification: "required",
                            challenge: request.request,
                            ...(tauriGetFn && { getFn: tauriGetFn }),
                        });
                    const assertion = {
                        id: raw.id,
                        response: { metadata, signature },
                    };
                    client.sendSignatureResponse(request.id, {
                        signature: btoa(JSON.stringify(assertion)),
                    });
                    return;
                }

                // Default `"onchain"` flow: smart-account-formatted Hex blob
                // ready to plug into a userOp validator.
                const signature = await signHashViaWebAuthN({
                    hash: request.request,
                    wallet: session,
                });

                client.sendSignatureResponse(request.id, { signature });
            } catch (error) {
                console.warn("Failed to sign signature request", error);
                client.sendSignatureResponse(request.id, {
                    reason: {
                        code: "user-declined",
                        detail:
                            error instanceof Error
                                ? error.message
                                : "Unknown error",
                    },
                });
                throw error;
            }
        },
    });
}

/**
 * Hooks used to decline a signature request
 */
export function useDeclineSignatureRequest({
    client,
}: {
    client: TargetPairingClient;
}) {
    return useCallback(
        (request: TargetPairingPendingSignature) => {
            client.sendSignatureResponse(request.id, {
                reason: { code: "user-declined", detail: "Declined" },
            });
        },
        [client]
    );
}
