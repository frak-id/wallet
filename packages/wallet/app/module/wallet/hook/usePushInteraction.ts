import { authenticatedBackendApi } from "@/context/common/backendClient";
import { pushBackupData } from "@/context/sdk/utils/backup";
import { sessionAtom } from "@/module/common/atoms/session";
import { useGetSafeSdkSession } from "@/module/common/hook/useGetSafeSdkSession";
import type { PreparedInteraction } from "@frak-labs/core-sdk";
import { jotaiStore } from "@module/atoms/store";
import { trackEvent } from "@module/utils/trackEvent";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import type { Hex } from "viem";
import { addPendingInteractionAtom } from "../atoms/pendingInteraction";

export function usePushInteraction() {
    const { sdkSession, getSdkSession } = useGetSafeSdkSession();

    // Read from the jotai store
    const currentSession = useAtomValue(sessionAtom);
    const sessionsRef = useRef(undefined as typeof currentSession | undefined);
    useEffect(() => {
        sessionsRef.current = currentSession;
    }, [currentSession]);

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
            const userAddress = sessionsRef?.current?.address;
            // If no current wallet present
            if (!userAddress) {
                // Save the pending interaction
                jotaiStore.set(addPendingInteractionAtom, {
                    productId,
                    interaction,
                    signature,
                    timestamp: Date.now(),
                });
                await pushBackupData({ productId });
                return { status: "pending-wallet" } as const;
            }

            // Fetch the token that will be used to push the interaction
            const safeSession = sdkSession ?? (await getSdkSession()).data;
            if (!safeSession) {
                return { status: "no-sdk-session" } as const;
            }

            // Otherwise, just set the user referred on product
            try {
                const { data, error } =
                    await authenticatedBackendApi.interactions.push.post({
                        interactions: [
                            {
                                wallet: userAddress,
                                productId,
                                interaction,
                                signature,
                            },
                        ],
                    });
                const delegationId = data?.[0];
                if (error || !delegationId) {
                    console.error("Unable to push the interactions", error);
                    return { status: "push-error" } as const;
                }

                trackEvent("interaction-pushed", {
                    productId,
                    handlerType: interaction.handlerTypeDenominator,
                    data: interaction.interactionData,
                });

                return { status: "success", delegationId } as const;
            } catch (error) {
                console.error("Unable to push the interactions", error);
                return { status: "push-error" } as const;
            }
        },
        [sdkSession, getSdkSession]
    );
}
