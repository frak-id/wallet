import { isAndroid, isIOS } from "@frak-labs/app-essentials/utils/platform";
import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { trackEvent } from "../../common/analytics";
import type { SharingSource } from "../../common/analytics/events";
import { getInvoke } from "../../common/tauri";

type TauriShareResponse = { shared: boolean };

type TauriSharePayload = {
    url: string;
    text?: string;
    title?: string;
    imageUrl?: string;
};

/**
 * Invoke the native share sheet provided by the `tauri-plugin-frak-share`
 * plugin. Runs Intent.ACTION_SEND on Android and UIActivityViewController on
 * iOS so shared links go through the OS chooser instead of the (unavailable)
 * web Share API inside Tauri's WebView.
 *
 * `url`, `text`, `title` and `imageUrl` are passed as separate fields so the
 * native layer can:
 *   - hand the URL to iOS as a typed `URL` activity item (Messages / Mail /
 *     Safari render a link card instead of parsing the URL out of free-form text),
 *   - attach `LPLinkMetadata` with the optional `imageUrl` for the rich
 *     preview header on iOS 13+,
 *   - populate `EXTRA_TITLE` + a FileProvider-backed `ClipData` thumbnail on
 *     Android 10+ so the chooser shows a branded preview tile.
 */
async function invokeTauriShare(payload: TauriSharePayload): Promise<boolean> {
    const invoke = await getInvoke();
    const response = await invoke<TauriShareResponse>(
        "plugin:frak-share|share_text",
        payload
    );
    // iOS returns the real `completed` flag; Android resolves as soon as the
    // chooser is presented (always true). Either way this indicates no error.
    return response?.shared ?? true;
}

export type ShareLinkData = {
    title?: string;
    text?: string;
    /**
     * Optional remote image URL (brand logo, product shot, hero image).
     * Used by the native plugin to populate the rich preview shown above
     * the activity grid (iOS `LPLinkMetadata.iconProvider`, Android
     * `ClipData` preview tile). Ignored on web — `navigator.share` does
     * not expose a standardised preview image field.
     */
    imageUrl?: string;
};

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
 * Inside a Tauri WebView (iOS / Android app shells) `navigator.share` is not
 * available, so the hook routes through the custom `frak-share` plugin which
 * opens the OS-level share sheet.
 *
 * @param link - The link to share (null disables sharing)
 * @param shareData - Title/text/imageUrl metadata for the share dialog.
 *                   `imageUrl` only affects the native (Tauri) flow.
 * @param options - `source` is required; optional `merchantId`, `onShared`, and standard mutation callbacks.
 */
export function useShareLink(
    link: string | null,
    shareData: ShareLinkData,
    options: {
        source: SharingSource;
        merchantId?: string;
        onShared?: () => void;
    } & MutationOptions
) {
    // `frak-share` only ships iOS (UIActivityViewController) and Android
    // (Intent.ACTION_SEND) handlers, so gate the Tauri path on those two
    // platforms instead of the generic `isTauri()` check.
    const useTauriShare = isIOS() || isAndroid();
    const canShare =
        useTauriShare ||
        (typeof navigator !== "undefined" &&
            typeof navigator.share === "function");

    const { source, merchantId, onShared, ...mutationOptions } = options;

    const mutation = useMutation({
        ...mutationOptions,
        mutationKey: ["sharing", "trigger", source, link ?? "no-link"],
        mutationFn: async () => {
            if (!link) return;

            // If we can't share, early exit
            if (!canShare) return;

            // Tauri (iOS / Android) routes through the native plugin because
            // `navigator.share` is not exposed inside the Tauri WebView.
            if (useTauriShare) {
                try {
                    const shared = await invokeTauriShare({
                        url: link,
                        // Keep `text` and `url` as separate fields so the
                        // native layer can render a proper URL preview
                        // instead of parsing it out of concatenated text.
                        text: shareData.text,
                        title: shareData.title,
                        imageUrl: shareData.imageUrl,
                    });
                    if (!shared) return;
                    trackEvent("sharing_link_shared", {
                        source,
                        merchant_id: merchantId,
                        link,
                    });
                    onShared?.();
                    return true;
                } catch (err) {
                    console.warn(err);
                    return;
                }
            }

            const data = {
                title: shareData.title,
                text: shareData.text,
                url: link,
            };

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
