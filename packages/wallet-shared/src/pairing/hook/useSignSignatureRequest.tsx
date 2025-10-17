import { useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { webauthnSessionAtom } from "../../common/atoms/session";
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
    const session = useAtomValue(webauthnSessionAtom);

    return useMutation({
        mutationKey: pairingKey.target.handleSignatureRequest(session?.address),
        mutationFn: async (request: TargetPairingPendingSignature) => {
            // If no session, throw
            if (!session) {
                throw new Error("No session found");
            }

            // Try to sign it, otherwise, reject it
            try {
                // Do the signature and respond to the ws
                const signature = await signHashViaWebAuthN({
                    hash: request.request,
                    wallet: session,
                });

                client.sendSignatureResponse(request.id, { signature });
            } catch (error) {
                console.warn("Failed to sign signature request", error);
                client.sendSignatureResponse(request.id, {
                    reason:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
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
                reason: "Declined",
            });
        },
        [client]
    );
}
