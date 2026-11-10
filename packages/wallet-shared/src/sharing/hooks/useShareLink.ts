import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { recordError, trackEvent } from "../../common/analytics";
import type { SharingSource } from "../../common/analytics/events";
import { sharingKey } from "../queryKeys";
import { canShareNatively, shareNatively } from "../utils/shareNatively";

export type ShareLinkData = {
    title?: string;
    text?: string;
    /** Preview thumbnail (brand logo, product shot); only the native Tauri sheet renders it. */
    imageUrl?: string;
};

/**
 * Shares `link` through the OS share sheet (see `shareNatively`).
 *
 * Fires `sharing_link_started` once the sheet opens and `sharing_link_shared` on completion,
 * both with `{source, merchant_id, link}`; `onShared` runs after the latter.
 *
 * @param link - The link to share (null disables sharing)
 * @param shareData - Title/text/imageUrl metadata for the share dialog
 * @param options - `source` is required; optional `merchantId`, `onShared`, and standard mutation callbacks.
 */
export function useShareLink(
    link: string | null,
    shareData: ShareLinkData,
    options: {
        source: SharingSource;
        merchantId?: string;
        /** Set by the sharing page when a native host opened it. */
        native?: boolean;
        onShared?: () => void;
    } & MutationOptions
) {
    const canShare = canShareNatively();

    const { source, merchantId, native, onShared, ...mutationOptions } =
        options;

    const mutation = useMutation({
        ...mutationOptions,
        mutationKey: sharingKey.trigger(source, link),
        mutationFn: async () => {
            if (!(link && canShare)) return;

            // Before the sheet opens, so a dismissed chooser still counts as intent.
            trackEvent("sharing_link_started", {
                source,
                merchant_id: merchantId,
                link,
                native,
            });

            let shared: boolean;
            try {
                // `url` stays apart from `text` so iOS renders a link card instead of parsing free text.
                shared = await shareNatively({ ...shareData, url: link });
            } catch (err) {
                // A dismissed sheet resolves `false`, so a rejection is a real failure.
                recordError(err, {
                    source: "sharing",
                    context: {
                        sharing_source: source,
                        merchant_id: merchantId,
                    },
                });
                return;
            }
            if (!shared) return;

            trackEvent("sharing_link_shared", {
                source,
                merchant_id: merchantId,
                link,
                native,
            });
            onShared?.();
            return true;
        },
    });
    return { ...mutation, canShare };
}
