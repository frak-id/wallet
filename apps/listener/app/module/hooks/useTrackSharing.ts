import { useSendInteraction } from "./useSendInteraction";

/**
 * Track sharing interaction.
 * Thin wrapper around useSendInteraction for backward compatibility.
 */
export function useTrackSharing() {
    const { mutate, mutateAsync, ...rest } = useSendInteraction();

    return {
        ...rest,
        mutate: () => mutate({ type: "sharing" }),
        mutateAsync: () => mutateAsync({ type: "sharing" }),
    };
}
