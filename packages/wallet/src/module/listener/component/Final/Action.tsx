import { ButtonAction } from "@/module/listener/component/ButtonAction";
import styles from "@/module/listener/component/Modal/index.module.css";
import { usePushInteraction } from "@/module/wallet/hook/usePushInteraction";
import {
    type FinalActionType,
    FrakContextManager,
} from "@frak-labs/nexus-sdk/core";
import { ReferralInteractionEncoder } from "@frak-labs/nexus-sdk/interactions";
import { jotaiStore } from "@module/atoms/store";
import { useCopyToClipboardWithState } from "@module/hook/useCopyToClipboardWithState";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Share } from "lucide-react";
import { tryit } from "radash";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { modalDisplayedRequestAtom } from "../../atoms/modalEvents";
import { useModalTranslation } from "../../hooks/useModalTranslation";

export function FinalModalActionComponent({
    action,
    isSuccess,
}: { action: FinalActionType; isSuccess: boolean }) {
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

    // todo: Display some stuff for the reward? Or autoskip it?
    return null;
}

/**
 * Sharing buttons component
 * @param shareWithFrak
 * @param appName
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
    const { address } = useAccount();
    const { copied, copy } = useCopyToClipboardWithState();
    const { t } = useModalTranslation();
    const pushInteraction = usePushInteraction();
    const isInteractionPushed = useRef(false);

    // Get our final sharing link
    const { data: finalSharingLink } = useQuery({
        queryKey: ["final-modal", "sharing", link, isModalSuccess, address],
        queryFn: async () => {
            if (!link) return null;

            if (isModalSuccess) {
                // Ensure the sharing link contain the current nexus wallet as referrer
                return await FrakContextManager.update({
                    url: link,
                    context: {
                        r: address,
                    },
                });
            }

            // Remove the referrer from the sharing link
            return FrakContextManager.remove(link);
        },
    });

    // Trigger native sharing
    const {
        data: shareResult,
        mutate: triggerSharing,
        isPending: isSharing,
    } = useMutation({
        mutationKey: [
            "final-modal",
            "sharing",
            "system-sharing",
            finalSharingLink,
        ],
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
    useEffect(() => {
        if (!isModalSuccess) return;
        if (!(copied || shareResult)) return;
        if (isInteractionPushed.current) return;

        // Get the current modal metadata
        const metadata = jotaiStore.get(modalDisplayedRequestAtom);
        if (!metadata) return;

        // Mark it at done to ensure we don't do it twice
        isInteractionPushed.current = true;

        // Send the referral link created event
        console.log("Pushing the referral link created event", {
            productId: metadata.context.productId,
        });
        pushInteraction({
            productId: metadata.context.productId,
            interaction: ReferralInteractionEncoder.createLink(),
        }).then((result) => {
            console.log("Referral link created event pushed", result);
        });
    }, [isModalSuccess, copied, shareResult, pushInteraction]);

    return (
        <div className={styles.modalListener__sharingButtons}>
            <ButtonAction
                onClick={async () => {
                    if (!finalSharingLink) return;
                    copy(finalSharingLink);
                }}
            >
                <Copy size={32} absoluteStrokeWidth={true} />
                {t(copied ? "sharing.btn.copySuccess" : "sharing.btn.copy")}
            </ButtonAction>
            <ButtonAction disabled={isSharing} onClick={() => triggerSharing()}>
                <Share size={32} absoluteStrokeWidth={true} />{" "}
                {shareResult ?? t("sharing.btn.share")}
            </ButtonAction>
        </div>
    );
}
