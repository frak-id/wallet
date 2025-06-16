import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { trackGenericEvent } from "../../common/analytics";
import { useListenerTranslation } from "../providers/ListenerUiProvider";
import { listenerSharingKey } from "../queryKeys/sharing";

export function useShareLink(link: string | null, options?: MutationOptions) {
    const { t } = useListenerTranslation();

    return useMutation({
        ...options,
        mutationKey: listenerSharingKey.sharing.trigger(link),
        mutationFn: async () => {
            if (!link) return;

            // Build our sharing data
            const shareData = {
                title: t("sharing.title"),
                text: t("sharing.text"),
                url: link,
            };

            // If we can't share, early exit
            if (
                typeof navigator === "undefined" ||
                typeof navigator.share !== "function"
            )
                return;
            if (!navigator.canShare(shareData)) return;

            // try to share the link
            try {
                await navigator.share(shareData);
                trackGenericEvent("sharing-share-link", {
                    link: link,
                });
                // If no error, return the shared state
                return t("sharing.btn.shareSuccess");
            } catch (err) {
                console.warn(err);
            }
        },
    });
}
