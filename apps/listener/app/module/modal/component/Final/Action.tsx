import { type FinalActionType, FrakContextManager } from "@frak-labs/core-sdk";
import {
    clientIdStore,
    prefixModalCss,
    trackGenericEvent,
    useCopyToClipboardWithState,
} from "@frak-labs/wallet-shared";
import { Copy, Share } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { ButtonAction } from "@/module/modal/component/ButtonAction";
import styles from "@/module/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";
import { useSafeResolvingContext } from "@/module/stores/hooks";
import { useShareLink } from "../../../hooks/useShareLink";
import { useTrackSharing } from "../../../hooks/useTrackSharing";

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
    const { sourceUrl, merchantId } = useSafeResolvingContext();
    const clientId = clientIdStore((s) => s.clientId);
    const { copy } = useCopyToClipboardWithState();
    const { t } = useListenerTranslation();
    const { mutate: trackSharing } = useTrackSharing();

    const finalSharingLink = useMemo(() => {
        const url = link ?? sourceUrl;
        if (isModalSuccess && clientId && merchantId) {
            return FrakContextManager.update({
                url,
                context: {
                    v: 2,
                    c: clientId,
                    m: merchantId,
                    t: Math.floor(Date.now() / 1000),
                },
            });
        }

        return FrakContextManager.remove(url);
    }, [link, isModalSuccess, clientId, merchantId, sourceUrl]);

    // Trigger native sharing
    const { mutate: triggerSharing, isPending: isSharing } = useShareLink(
        finalSharingLink,
        {
            onSuccess: (message) => {
                message && toast.success(message as string);
            },
        }
    );

    return (
        <div className={styles.modalListener__sharingButtons}>
            <ButtonAction
                onClick={async () => {
                    if (!finalSharingLink) return;
                    copy(finalSharingLink);
                    trackGenericEvent("sharing-copy-link", {
                        link: finalSharingLink,
                    });
                    trackSharing();
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
