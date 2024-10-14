import { pushInteraction } from "@/context/interaction/action/pushInteraction";
import { sessionAtom } from "@/module/common/atoms/session";
import { useGetSafeSdkSession } from "@/module/common/hook/useGetSafeSdkSession";
import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { useCallback } from "react";
import type { Hex } from "viem";
import { addPendingInteractionAtom } from "../atoms/pendingInteraction";

export function usePushInteraction() {
    const { sdkSession, getSdkSession } = useGetSafeSdkSession();

    return useCallback(
        async ({
            productId,
            interaction,
            signature,
        }: {
            productId: Hex;
            interaction: PreparedInteraction;
            signature?: Hex;
        }) => {
            const userAddress = jotaiStore.get(sessionAtom)?.address;
            // If no current wallet present
            if (!userAddress) {
                // Save the pending interaction
                jotaiStore.set(addPendingInteractionAtom, {
                    productId,
                    interaction,
                    signature,
                    timestamp: Date.now(),
                });
                return { status: "pending-wallet" } as const;
            }

            // Fetch the token that will be used to push the interaction
            const safeSession = sdkSession ?? (await getSdkSession()).data;
            if (!safeSession) {
                return { status: "no-sdk-session" } as const;
            }

            // Otherwise, just set the user referred on product
            try {
                const delegationId = await pushInteraction({
                    wallet: userAddress,
                    toPush: {
                        productId,
                        interaction,
                        submittedSignature: signature,
                    },
                    sdkToken: safeSession.token,
                });
                if (!delegationId) {
                    return { status: "push-error" } as const;
                }
                return { status: "success", delegationId } as const;
            } catch (error) {
                console.error("Unable to push the interactions", error);
                return { status: "push-error" } as const;
            }
        },
        [sdkSession, getSdkSession]
    );
}
