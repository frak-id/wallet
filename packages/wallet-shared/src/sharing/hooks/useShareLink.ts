import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { trackEvent } from "../../common/analytics";
import type { SharingSource } from "../../common/analytics/events";

/**
 * Hook to trigger the native Web Share API.
 *
 * Fires `sharing_link_shared` with `{source, merchant_id, link}` on success
 * so every sharing entry point emits uniform analytics without the caller
 * having to remember to track it.
 *
 * `onShared` runs after the analytics event and is the integration point for
 * the listener's `useTrackSharing` backend interaction — keeps transport
 * concerns out of this hook.
 *
 * @param link - The link to share (null disables sharing)
 * @param shareData - Title and text for the share dialog
 * @param options - `source` is required; optional `merchantId`, `onShared`, and standard mutation callbacks.
 */
export function useShareLink(
    link: string | null,
    shareData: { title: string; text: string },
    options: {
        source: SharingSource;
        merchantId?: string;
        onShared?: () => void;
    } & MutationOptions
) {
    const canShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

    const { source, merchantId, onShared, ...mutationOptions } = options;

    const mutation = useMutation({
        ...mutationOptions,
        mutationKey: ["sharing", "trigger", source, link ?? "no-link"],
        mutationFn: async () => {
            if (!link) return;

            const data = {
                title: shareData.title,
                text: shareData.text,
                url: link,
            };

            // If we can't share, early exit
            if (!canShare) return;
            if (!navigator.canShare(data)) return;

            // Try to share the link
            try {
                await navigator.share(data);
                trackEvent("sharing_link_shared", {
                    source,
                    merchant_id: merchantId,
                    link,
                });
                onShared?.();
                return true;
            } catch (err) {
                console.warn(err);
            }
        },
    });
    return { ...mutation, canShare };
}
