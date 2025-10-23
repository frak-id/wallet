import type { PreparedInteraction } from "@frak-labs/core-sdk";
import { pushBackupData } from "@frak-labs/wallet-shared/sdk/utils/backup";
import {
    selectSession,
    sessionStore,
} from "@frak-labs/wallet-shared/stores/sessionStore";
import { walletStore } from "@frak-labs/wallet-shared/stores/walletStore";
import { useCallback, useEffect, useRef } from "react";
import type { Hex } from "viem";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { useGetSafeSdkSession } from "@/module/common/hook/useGetSafeSdkSession";
import { trackGenericEvent } from "../../common/analytics";

export function usePushInteraction() {
    const { sdkSession, getSdkSession } = useGetSafeSdkSession();

    // Read from the jotai store
    const currentSession = sessionStore(selectSession);
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
                walletStore.getState().addPendingInteraction({
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
                    await authenticatedWalletApi.interactions.push.post({
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

                trackGenericEvent("interaction-pushed", {
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
