import styles from "@/module/listener/component/Modal/index.module.css";
import { NexusContextManager } from "@frak-labs/nexus-sdk/core";
import { useCopyToClipboardWithState } from "@module/hook/useCopyToClipboardWithState";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useMutation } from "@tanstack/react-query";
import { tryit } from "radash";
import type { Hex } from "viem";
import { useAccount } from "wagmi";

/**
 * Sharing buttons component
 * @param shareWithFrak
 * @param appName
 * @param link
 * @param popupTitle
 * @param text
 */
export function SharingButtons({
    shareWithFrak = true,
    appName,
    link,
    popupTitle,
    text,
}: {
    shareWithFrak?: boolean;
    appName: string;
    link?: string;
    popupTitle?: string;
    text?: string;
}) {
    const { address } = useAccount();
    const { copied, copy } = useCopyToClipboardWithState();

    const {
        data: shareResult,
        mutate: triggerSharing,
        isPending: isSharing,
    } = useMutation({
        mutationKey: ["modal-notRewarded-sharing"],
        mutationFn: async () => {
            if (!link) return;

            const sharingLink = await getSharingLink(
                shareWithFrak,
                link,
                address
            );
            if (!sharingLink) return;

            // Build our sharing data
            const shareData = {
                title: popupTitle ?? `${appName} invite link`,
                text: text ?? "Discover this awesome product!",
                url: sharingLink,
            };

            // Trigger copy to clipboard if no native sharing
            if (
                typeof navigator !== "undefined" &&
                typeof navigator.share === "function" &&
                navigator.canShare(shareData)
            ) {
                const [err] = await tryit(() => navigator.share(shareData))();
                // If no error, return the shared state
                if (!err) return "Shared!";
            }
        },
    });

    return (
        <>
            <button
                type={"button"}
                className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
                onClick={async () => {
                    if (!link) return;
                    const sharingLink = await getSharingLink(
                        shareWithFrak,
                        link,
                        address
                    );
                    if (!sharingLink) return;
                    copy(sharingLink);
                }}
            >
                {copied ? "Copied!" : "Copy link"}
            </button>
            <button
                type={"button"}
                className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
                disabled={isSharing}
                onClick={() => triggerSharing()}
            >
                {shareResult ?? "Share"}
            </button>
        </>
    );
}

/**
 * Get the sharing link with the current nexus wallet as referrer
 * or remove the referrer from the sharing link
 * @param shareWithFrak
 * @param link
 * @param address
 */
async function getSharingLink(
    shareWithFrak: boolean,
    link: string,
    address?: Hex
) {
    if (shareWithFrak) {
        // Ensure the sharing link contain the current nexus wallet as referrer
        return await NexusContextManager.update({
            url: link,
            context: {
                r: address,
            },
        });
    }

    // Remove the referrer from the sharing link
    return NexusContextManager.remove(link);
}
