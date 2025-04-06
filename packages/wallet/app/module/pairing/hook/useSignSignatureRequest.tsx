import { useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
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
}: { client: TargetPairingClient }) {
    const session = useAtomValue(webauthnSessionAtom);

    return useMutation({
        mutationKey: pairingKey.target.handleSignatureRequest(session?.address),
        mutationFn: async (request: TargetPairingPendingSignature) => {
            // If no session, throw
            if (!session) {
                // todo: Should also send a ws rejection?
                throw new Error("No session found");
            }

            // Do the signature and respond to the ws
            const signature = await signHashViaWebAuthN({
                hash: request.request,
                wallet: session,
            });

            await client.sendSignatureResponse(request.id, signature);
        },
    });
}
