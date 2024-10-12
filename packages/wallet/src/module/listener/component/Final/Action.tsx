import { ButtonAction } from "@/module/listener/component/ButtonAction";
import styles from "@/module/listener/component/Modal/index.module.css";
import {
    type FinalActionType,
    FrakContextManager,
} from "@frak-labs/nexus-sdk/core";
import { useCopyToClipboardWithState } from "@module/hook/useCopyToClipboardWithState";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Share } from "lucide-react";
import { tryit } from "radash";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";

export function FinalModalActionComponent({
    appName,
    action,
    isSuccess,
}: { appName: string; action: FinalActionType; isSuccess: boolean }) {
    if (action.key === "sharing") {
        return (
            <SharingButtons
                appName={appName}
                useFrakContext={isSuccess}
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
    useFrakContext,
    appName,
    link,
    popupTitle,
    text,
}: {
    useFrakContext: boolean;
    appName: string;
    link?: string;
    popupTitle?: string;
    text?: string;
}) {
    const { address } = useAccount();
    const { copied, copy } = useCopyToClipboardWithState();
    const { t } = useTranslation();

    // Get our final sharing link
    const { data: finalSharingLink } = useQuery({
        queryKey: ["final-modal", "sharing", link, useFrakContext, address],
        queryFn: async () => {
            if (!link) return null;

            if (useFrakContext) {
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
                title:
                    popupTitle ??
                    t("sharing.default.title", { productName: appName }),
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
