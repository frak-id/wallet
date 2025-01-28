import { useListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import { usePushInteraction } from "@/module/wallet/hook/usePushInteraction";
import { ReferralInteractionEncoder } from "@frak-labs/core-sdk/interactions";
import { useEffect, useRef } from "react";

const globalInteractionState = {
    isInteractionPushed: false,
    isPending: false,
};

/**
 * Hook to trigger a push interaction when a condition is met
 */
export function useTriggerPushInterraction({
    conditionToTrigger,
}: { conditionToTrigger: boolean }) {
    const pushInteraction = usePushInteraction();
    const { resolvingContext } = useListenerUI();
    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;

        return () => {
            // Only reset state on actual unmount not rerender
            if (isMounted.current) {
                globalInteractionState.isInteractionPushed = false;
                globalInteractionState.isPending = false;
            }
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        const triggerInteraction = async () => {
            if (
                !conditionToTrigger ||
                globalInteractionState.isInteractionPushed ||
                globalInteractionState.isPending
            ) {
                return;
            }

            // Set pending state to prevent concurrent calls
            globalInteractionState.isPending = true;

            console.log("Pushing the referral link created event", {
                productId: resolvingContext.productId,
            });

            try {
                const result = await pushInteraction({
                    productId: resolvingContext.productId,
                    interaction: ReferralInteractionEncoder.createLink(),
                });
                console.log("Referral link created event pushed", result);
                globalInteractionState.isInteractionPushed = true;
            } catch (error) {
                console.error("Failed to push interaction:", error);
                // Reset pending state on error to allow retry
                globalInteractionState.isPending = false;
            } finally {
                globalInteractionState.isPending = false;
            }
        };

        triggerInteraction();
    }, [conditionToTrigger, pushInteraction, resolvingContext.productId]);

    return null;
}
