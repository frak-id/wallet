import { trackEvent } from "@/module/common/utils/trackEvent";
import { useSafeResolvingContext } from "@/module/listener/atoms/resolvingContext";
import { useTriggerPushInterraction } from "@/module/listener/hooks/useTriggerPushInterraction";
import { ButtonAction } from "@/module/listener/modal/component/ButtonAction";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import { listenerSharingKey } from "@/module/listener/queryKeys/sharing";
import { type FinalActionType, FrakContextManager } from "@frak-labs/core-sdk";
import { useCopyToClipboardWithState } from "@shared/module/hook/useCopyToClipboardWithState";
import { prefixModalCss } from "@shared/module/utils/prefixModalCss";
import { useMutation } from "@tanstack/react-query";
import { Copy, Share } from "lucide-react";
import { tryit } from "radash";
import { useMemo } from "react";
import { useAccount } from "wagmi";

export function FinalModalActionComponent({
    action,
    isSuccess,
    onFinish,
}: {
    action: FinalActionType;
    isSuccess: boolean;
    onFinish: (args: object) => void;
}) {
    const { t } = useListenerTranslation();

    if (action.key === "sharing") {
        return (
            <SharingButtons
                isModalSuccess={isSuccess}
                popupTitle={action?.options?.popupTitle}
                text={action?.options?.text}
                link={action?.options?.link}
            />
        );
    }

    return (
        <button
            type={"button"}
            className={`${styles.modalListener__buttonLink} ${prefixModalCss("button-link")}`}
            onClick={() => {
                onFinish({});
                trackEvent("cta-dismissed");
            }}
        >
            {t("sdk.modal.default.dismissBtn")}
        </button>
    );
}

/**
 * Sharing buttons component
 * @param shareWithFrak
 * @param link
 * @param popupTitle
 * @param text
 */
function SharingButtons({
    isModalSuccess,
    link,
    popupTitle,
    text,
}: {
    isModalSuccess: boolean;
    link?: string;
    popupTitle?: string;
    text?: string;
}) {
    const { sourceUrl } = useSafeResolvingContext();
    const { address } = useAccount();
    const { copied, copy } = useCopyToClipboardWithState();
    const { t } = useListenerTranslation();

    // Get our final sharing link
    const finalSharingLink = useMemo(() => {
        const url = link ?? sourceUrl;
        if (isModalSuccess) {
            // Ensure the sharing link contain the current nexus wallet as referrer
            return FrakContextManager.update({
                url,
                context: {
                    r: address,
                },
            });
        }

        // Remove the referrer from the sharing link
        return FrakContextManager.remove(url);
    }, [link, isModalSuccess, address, sourceUrl]);

    // Trigger native sharing
    const {
        data: shareResult,
        mutate: triggerSharing,
        isPending: isSharing,
    } = useMutation({
        mutationKey: listenerSharingKey.sharing.trigger(
            "final-modal",
            finalSharingLink
        ),
        mutationFn: async () => {
            if (!finalSharingLink) return;

            // Build our sharing data
            const shareData = {
                title: popupTitle ?? t("sharing.default.title"),
                text: text ?? t("sharing.default.text"),
                url: finalSharingLink,
            };

            // Trigger copy to clipboard if no native sharing
            if (
                typeof navigator !== "undefined" &&
                typeof navigator.share === "function" &&
                navigator.canShare(shareData)
            ) {
                const [err] = await tryit(() => navigator.share(shareData))();
                // If no error, return the shared state
                if (!err) return t("sharing.btn.shareSuccess");
            }
        },
    });

    // Listen to different stuff to trigger the interaction push
    useTriggerPushInterraction({
        conditionToTrigger: isModalSuccess && (copied || !!shareResult),
    });

    return (
        <div className={styles.modalListener__sharingButtons}>
            <ButtonAction
                onClick={async () => {
                    if (!finalSharingLink) return;
                    copy(finalSharingLink);
                    trackSharingLink("sharing-copy-link", finalSharingLink);
                }}
            >
                <Copy size={32} absoluteStrokeWidth={true} />
                {t(copied ? "sharing.btn.copySuccess" : "sharing.btn.copy")}
            </ButtonAction>
            <ButtonAction
                disabled={isSharing}
                onClick={() => {
                    if (!finalSharingLink) return;
                    triggerSharing();
                    trackSharingLink("sharing-share-link", finalSharingLink);
                }}
            >
                <Share size={32} absoluteStrokeWidth={true} />{" "}
                {shareResult ?? t("sharing.btn.share")}
            </ButtonAction>
        </div>
    );
}

/**
 * Track the sharing link
 * @param name
 * @param link
 */
function trackSharingLink(name: string, link: string) {
    trackEvent(name, { link });
}
