import { modalStepsAtom } from "@/module/listener/atoms/modalEvents";
import styles from "@/module/listener/component/Modal/index.module.css";
import type { NotRewardedModalStepType } from "@frak-labs/nexus-sdk/core";
import { NexusContextManager } from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useMutation } from "@tanstack/react-query";
import { useCopyToClipboard } from "@uidotdev/usehooks";
import { useAtomValue } from "jotai";
import { tryit } from "radash";
import type { PropsWithChildren } from "react";

/**
 * The component for the not rewarded step of a modal
 * @param appName
 * @param params
 * @param onFinish
 * @constructor
 */
export function NotRewardedModalStep({
    appName,
    params,
}: {
    appName: string;
    params: NotRewardedModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    const { metadata, sharing } = params;
    const [, copyToClipboard] = useCopyToClipboard();

    const {
        data: shareResult,
        mutate: triggerSharing,
        isPending: isSharing,
    } = useMutation({
        mutationKey: ["modal-notRewarded-sharing", params],
        mutationFn: async () => {
            if (!sharing?.link) return;

            // Remove the referrer from the sharing link
            const cleanedSharingLink = NexusContextManager.remove(
                sharing?.link
            );

            // Build our sharing data
            const shareData = {
                title: sharing?.popupTitle ?? `${appName} invite link`,
                text: sharing?.text ?? "Discover this awesome product!",
                url: cleanedSharingLink,
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
            await copyToClipboard(cleanedSharingLink);
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
                            {shareResult ?? "Share"}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

/**
 * The button for the not rewarded step of a modal
 * @param children
 * @constructor
 */
export function NotRewardedModalStepButton({ children }: PropsWithChildren) {
    const modalSteps = useAtomValue(modalStepsAtom);
    const notRewardedIndex = modalSteps?.steps?.findIndex(
        (step) => step.key === "notRewarded"
    );

    if (!notRewardedIndex) return null;

    return (
        <button
            type={"button"}
            className={`${styles.modalListener__buttonLink} ${prefixModalCss("button-link")}`}
            onClick={() => {
                // Go to the not rewarded step
                jotaiStore.set(modalStepsAtom, (current) => {
                    if (!current) return null;
                    return {
                        ...current,
                        currentStep: notRewardedIndex,
                    };
                });
            }}
        >
            {children}
        </button>
    );
}
