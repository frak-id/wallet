import { useQuery } from "@tanstack/react-query";
import { type Hex, isAddressEqual } from "viem";
import { PressInteractionEncoder } from "../../../core/interactions";
import { useSendInteraction } from "../useSendInteraction";
import { useWalletStatus } from "../useWalletStatus";
import { useNexusContext } from "../utils/useNexusContext";

/**
 * Helper hook to automatically submit a press referral interaction when detected
 *   -> And automatically set the referral context in the url
 * @param contentId
 */
export function usePressReferralInteraction({ contentId }: { contentId: Hex }) {
    // Get the current nexus context
    const { nexusContext, updateContextAsync } = useNexusContext();

    // Get the wallet status
    const { data: walletStatus } = useWalletStatus();

    // Hook to send an interaction
    const { mutateAsync: sendInteraction } = useSendInteraction();

    // Setup the query that will transmit the referral interaction
    useQuery({
        gcTime: 0,
        queryKey: [
            "nexus-sdk",
            "auto-press-referral-interaction",
            nexusContext?.referrer ?? "no-referrer",
            walletStatus?.key ?? "no-wallet-status",
        ],
        queryFn: async () => {
            // If no context or no wallet connected, early exit
            if (!nexusContext || walletStatus?.key !== "connected") return null;

            // If context and wallet present, and same referrer address, early exit
            if (isAddressEqual(nexusContext.referrer, walletStatus.wallet))
                return null;

            // Build the press referral interaction
            const interaction = PressInteractionEncoder.referred({
                referrer: nexusContext.referrer,
            });

            // Send the interaction
            await sendInteraction({ contentId, interaction });

            // Update the context with the current wallet as referrer
            await updateContextAsync({ referrer: walletStatus.wallet });

            return null;
        },
    });
}
