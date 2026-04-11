import { type MutationOptions, useMutation } from "@tanstack/react-query";

/**
 * Hook to trigger the native Web Share API.
 * Returns a mutation that can be triggered to share a link.
 *
 * @param link - The link to share (null disables sharing)
 * @param shareData - Title and text for the share dialog
 * @param options - Additional TanStack mutation options (use onSuccess to react to successful share)
 */
export function useShareLink(
    link: string | null,
    shareData: { title: string; text: string },
    options?: MutationOptions
) {
    const canShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";
    const mutation = useMutation({
        ...options,
        mutationKey: ["sharing", "trigger", link ?? "no-link"],
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
                return true;
            } catch (err) {
                console.warn(err);
            }
        },
    });
    return { ...mutation, canShare };
}
