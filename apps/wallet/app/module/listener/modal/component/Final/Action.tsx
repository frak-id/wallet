import { useSafeResolvingContext } from "@/module/listener/atoms/resolvingContext";
import { useTriggerPushInterraction } from "@/module/listener/hooks/useTriggerPushInterraction";
import { ButtonAction } from "@/module/listener/modal/component/ButtonAction";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import { type FinalActionType, FrakContextManager } from "@frak-labs/core-sdk";
import { useCopyToClipboardWithState } from "@frak-labs/ui/hook/useCopyToClipboardWithState";
import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import { Copy, Share } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { trackGenericEvent } from "../../../../common/analytics";
import { useShareLink } from "../../../hooks/useShareLink";

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
                trackGenericEvent("modal-dismissed");
            }}
        >
            {t("sdk.modal.dismiss.primaryAction")}
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
}: {
    isModalSuccess: boolean;
    link?: string;
}) {
    const { sourceUrl } = useSafeResolvingContext();
    const { address } = useAccount();
    const { copied, copy } = useCopyToClipboardWithState();
    const { t } = useListenerTranslation();

    // Get our final sharing link
    const finalSharingLink = useMemo(() => {
        const url = link ?? sourceUrl;
        if (isModalSuccess) {
            // Ensure the sharing link contain the current frak wallet as referrer
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
    } = useShareLink(finalSharingLink, {
        onSuccess: (message) => {
            message && toast.success(message as string);
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
                    trackGenericEvent("sharing-copy-link", {
                        link: finalSharingLink,
                    });
                    toast.success(t("sharing.btn.copySuccess"));
                }}
            >
                <Copy size={32} absoluteStrokeWidth={true} />
                {t("sharing.btn.copy")}
            </ButtonAction>
            <ButtonAction
                disabled={isSharing}
                onClick={() => {
                    if (!finalSharingLink) return;
                    triggerSharing();
                }}
            >
                <Share size={32} absoluteStrokeWidth={true} />{" "}
                {t("sharing.btn.share")}
            </ButtonAction>
        </div>
    );
}
