import { type FinalActionType, FrakContextManager } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/design-system/components/Button";
import { ConfirmationTooltip } from "@frak-labs/design-system/components/ConfirmationTooltip";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { ToastSurface } from "@frak-labs/design-system/components/ToastSurface";
import { CopyIcon, ShareIcon } from "@frak-labs/design-system/icons";
import {
    prefixModalCss,
    trackEvent,
    useCopyToClipboardWithState,
} from "@frak-labs/wallet-shared/common";
import {
    buildSharingLink,
    useShareLink,
} from "@frak-labs/wallet-shared/sharing";
import { clientIdStore } from "@frak-labs/wallet-shared/stores/clientIdStore";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import * as styles from "@/module/modal/component/Final/index.css";
import { useSafeResolvingContext } from "@/module/stores/hooks";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import { useListenerTranslation } from "@/ui/ListenerUiProvider";
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
        <Stack space="m" className={prefixModalCss("buttons-wrapper")}>
            <Button
                variant="primary"
                size="large"
                className={prefixModalCss("button-primary")}
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
            </Button>
        </Stack>
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
    const clientId = useStore(clientIdStore, (s) => s.clientId);
    const walletAddress = useStore(sessionStore, (s) => s.session?.address);
    const { copy } = useCopyToClipboardWithState();
    const { t } = useListenerTranslation();
    const { mutate: trackSharing } = useTrackSharing();

    // Shared "copied / shared" confirmation pill, auto-hidden after 2s.
    const [confirmation, setConfirmation] = useState<string | null>(null);
    useEffect(() => {
        if (!confirmation) return;
        const timer = setTimeout(() => setConfirmation(null), 2000);
        return () => clearTimeout(timer);
    }, [confirmation]);
    const defaultAttribution = useStore(
        resolvingContextStore,
        (s) => s.backendSdkConfig?.attribution
    );

    const finalSharingLink = useMemo(() => {
        const url = link ?? sourceUrl;
        if (isModalSuccess) {
            return (
                buildSharingLink({
                    clientId: clientId ?? undefined,
                    merchantId,
                    wallet: walletAddress,
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
        walletAddress,
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
            onSuccess: (didShare) => {
                if (didShare) {
                    setConfirmation(t("sharing.btn.shareSuccess"));
                }
            },
        }
    );

    return (
        <>
            {confirmation && (
                <ToastSurface
                    placement="top-center"
                    className={styles.copiedToast}
                >
                    <ConfirmationTooltip>{confirmation}</ConfirmationTooltip>
                </ToastSurface>
            )}
            <Stack space="m" className={prefixModalCss("buttons-wrapper")}>
                <Button
                    variant="primary"
                    size="large"
                    icon={<ShareIcon width={24} height={24} />}
                    disabled={isSharing}
                    className={prefixModalCss("button-primary")}
                    onClick={() => {
                        if (!finalSharingLink) return;
                        triggerSharing();
                    }}
                >
                    {t("sharing.btn.share")}
                </Button>
                <Button
                    variant="secondary"
                    size="large"
                    icon={<CopyIcon width={24} height={24} />}
                    className={prefixModalCss("button-secondary")}
                    onClick={async () => {
                        if (!finalSharingLink) return;
                        copy(finalSharingLink);
                        trackEvent("sharing_link_copied", {
                            source: "modal",
                            merchant_id: merchantId,
                            link: finalSharingLink,
                        });
                        trackSharing();
                        setConfirmation(t("sharing.btn.copySuccess"));
                    }}
                >
                    {t("sharing.btn.copy")}
                </Button>
            </Stack>
        </>
    );
}
