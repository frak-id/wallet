import styles from "@/module/listener/component/Modal/index.module.css";
import {
    NexusContextManager,
    type SuccessModalStepType,
} from "@frak-labs/nexus-sdk/core";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useMutation } from "@tanstack/react-query";
import { useCopyToClipboard } from "@uidotdev/usehooks";
import { tryit } from "radash";
import { useAccount } from "wagmi";

/**
 * The component for the success step of a modal
 * @param appName
 * @param params
 * @param onFinish
 * @constructor
 */
export function SuccessModalStep({
    appName,
    params,
}: {
    appName: string;
    params: SuccessModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    const { address } = useAccount();
    const { metadata, sharing } = params;
    const [, copyToClipboard] = useCopyToClipboard();

    const {
        data: shareResult,
        mutate: triggerSharing,
        isPending: isSharing,
    } = useMutation({
        mutationKey: ["modal-success-sharing", params],
        mutationFn: async () => {
            if (!sharing?.link) return;

            // Ensure the sharing link contain the current nexus wallet as referrer
            const sharingLink = await NexusContextManager.update({
                url: sharing.link,
                context: {
                    r: address,
                },
            });
            if (!sharingLink) return;

            // Build our sharing data
            const shareData = {
                title: sharing?.popupTitle ?? `${appName} invite link`,
                text: sharing?.text ?? "Discover this awesome product!",
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

            // Trigger native sharing stuff
            await copyToClipboard(sharingLink);
            return "Copied!";
        },
    });

    return (
        <>
            {metadata?.description && (
                <div
                    className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
                >
                    <p>{metadata.description}</p>
                </div>
            )}
            <div
                className={`${styles.modalListener__buttonsWrapper} ${prefixModalCss("buttons-wrapper")}`}
            >
                {sharing?.link && (
                    <div>
                        <button
                            type={"button"}
                            className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
                            disabled={isSharing}
                            onClick={() => triggerSharing()}
                        >
                            {shareResult ?? "Share to earn"}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
