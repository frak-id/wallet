import type { SendInteractionParamsType } from "@frak-labs/core-sdk";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "zustand";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import { sendInteraction } from "./useSendInteraction";

type SharingParams = Omit<
    Extract<SendInteractionParamsType, { type: "sharing" }>,
    "type"
>;

/**
 * Track sharing interaction.
 * Thin wrapper around useSendInteraction for backward compatibility.
 */
// React hook used by the lazy sharing flow. Keeps `@tanstack/react-query`
// out of `useSendInteraction.ts` (Ring 0, lives in `common`).
export function useTrackSharing() {
    const context = useStore(resolvingContextStore, (state) => state.context);
    const { mutate, mutateAsync, ...rest } = useMutation({
        mutationKey: ["send-interaction", context?.merchantId],
        mutationFn: (input: SharingParams | undefined) =>
            sendInteraction({ type: "sharing", ...input }),
    });

    return {
        ...rest,
        mutate: (params?: SharingParams) => mutate(params),
        mutateAsync: (params?: SharingParams) => mutateAsync(params),
    };
}
