import type { SuccessModalStepType } from "@frak-labs/nexus-sdk/core";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useMutation } from "@tanstack/react-query";
import { useCopyToClipboard } from "@uidotdev/usehooks";
import { tryit } from "radash";

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
    onFinish,
}: {
    appName: string;
    params: SuccessModalStepType["params"];
    onFinish: (args: object) => void;
}) {
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

            // Build our sharing data
            const shareData = {
                title: sharing?.popupTitle ?? `${appName} invite link`,
                text: sharing?.text ?? "Discover this awesome content!",
                url: sharing.link,
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
            await copyToClipboard(sharing.link);
            return "Copied!";
        },
    });

    return (
        <>
            {metadata?.description && (
                <div className={prefixModalCss("text")}>
                    <p>{metadata.description}</p>
                </div>
            )}
            <div className={prefixModalCss("buttons-wrapper")}>
                {sharing?.link && (
                    <div>
                        <button
                            type={"button"}
                            className={prefixModalCss("button-primary")}
                            disabled={isSharing}
                            onClick={() => triggerSharing()}
                        >
                            {shareResult ?? "Share to earn"}
                        </button>
                    </div>
                )}

                <div>
                    <button
                        type={"button"}
                        className={prefixModalCss("button-secondary")}
                        onClick={() => {
                            onFinish({});
                        }}
                    >
                        {metadata?.secondaryActionText ?? "Close"}
                    </button>
                </div>
            </div>
        </>
    );
}
