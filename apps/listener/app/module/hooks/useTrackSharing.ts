import type { SendInteractionParamsType } from "@frak-labs/core-sdk";
import { useSendInteraction } from "./useSendInteraction";

type SharingParams = Omit<
    Extract<SendInteractionParamsType, { type: "sharing" }>,
    "type"
>;

/**
 * Track sharing interaction.
 * Thin wrapper around useSendInteraction for backward compatibility.
 */
export function useTrackSharing() {
    const { mutate, mutateAsync, ...rest } = useSendInteraction();

    return {
        ...rest,
        mutate: (params?: SharingParams) =>
            mutate({ type: "sharing", ...params }),
        mutateAsync: (params?: SharingParams) =>
            mutateAsync({ type: "sharing", ...params }),
    };
}
