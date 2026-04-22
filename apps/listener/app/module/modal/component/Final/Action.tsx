import { type FinalActionType, FrakContextManager } from "@frak-labs/core-sdk";
import {
    buildSharingLink,
    clientIdStore,
    prefixModalCss,
    trackEvent,
    useCopyToClipboardWithState,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { Copy, Share } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { ButtonAction } from "@/module/modal/component/ButtonAction";
import styles from "@/module/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";
import { useSafeResolvingContext } from "@/module/stores/hooks";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
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
                trackEvent("modal_dismissed", {
                    last_step: "final",
                    completed: true,
                    source: "final_action",
                });
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
    const defaultAttribution = resolvingContextStore(
        (s) => s.backendSdkConfig?.attribution
    );

    const finalSharingLink = useMemo(() => {
        const url = link ?? sourceUrl;
        if (isModalSuccess) {
            return (
                buildSharingLink({
                    clientId: clientId ?? undefined,
                    merchantId,
                    baseUrl: url,
                    defaultAttribution,
                }) ?? FrakContextManager.remove(url)
            );
        }
        return FrakContextManager.remove(url);
    }, [
        link,
        isModalSuccess,
        clientId,
        merchantId,
        sourceUrl,
        defaultAttribution,
    ]);

    // Trigger native sharing — hook auto-fires `sharing_link_shared`.
    const { mutate: triggerSharing, isPending: isSharing } = useShareLink(
        finalSharingLink,
        {
            title: t("sharing.title"),
            text: t("sharing.text"),
        },
        {
            source: "modal",
            merchantId,
            onShared: () => trackSharing(),
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
                    trackEvent("sharing_link_copied", {
                        source: "modal",
                        merchant_id: merchantId,
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
