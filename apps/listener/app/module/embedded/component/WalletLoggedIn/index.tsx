import {
    type Currency,
    formatAmount,
    getCurrencyAmountKey,
} from "@frak-labs/core-sdk";
import {
    buildSharingLink,
    clientIdStore,
    OriginPairingState,
    trackEvent,
    useCopyToClipboardWithState,
    useGetUserBalance,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { cx } from "class-variance-authority";
import { toast } from "sonner";
import { Copy } from "@/module/common/icons/Copy";
import { Share } from "@/module/common/icons/Share";
import { prefixWalletCss } from "@/module/common/utils/prefixWalletCss";
import { ButtonWallet } from "@/module/embedded/component/ButtonWallet";
import {
    OnboardingShare,
    OnboardingWelcome,
} from "@/module/embedded/component/Onboarding";
import {
    useEmbeddedListenerUI,
    useListenerTranslation,
} from "@/module/providers/ListenerUiProvider";
import { useSafeResolvingContext } from "@/module/stores/hooks";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import { useTrackSharing } from "../../../hooks/useTrackSharing";
import styles from "./index.module.css";

/**
 * View for the logged in user
 * @constructor
 */
export function LoggedInComponent() {
    const {
        currentRequest: { configMetadata },
    } = useEmbeddedListenerUI();
    const { userBalance } = useGetUserBalance();
    const currencyAmountKey = getCurrencyAmountKey(configMetadata?.currency);
    const amount = userBalance?.total?.[currencyAmountKey] ?? 0;

    // Build the footer
    const footer = (
        <div
            className={cx(
                styles.modalListenerWallet__footer,
                prefixWalletCss("modalListenerWallet__footer")
            )}
        >
            <OriginPairingState type="embedded" />
        </div>
    );

    return (
        <>
            <Balance
                amount={amount}
                currency={configMetadata?.currency ?? "eur"}
            />
            <ActionButtons />
            {footer}
        </>
    );
}

function Balance({ amount, currency }: { amount: number; currency: Currency }) {
    const { t } = useListenerTranslation();

    return (
        <div className={styles.balance}>
            <h2 className={styles.balance__title}>{t("common.balance")}</h2>
            <p className={styles.balance__amount}>
                {formatAmount(amount, currency)}
            </p>
            <OnboardingWelcome />
        </div>
    );
}

function ActionButtons() {
    const {
        currentRequest: {
            params: { loggedIn },
        },
    } = useEmbeddedListenerUI();

    const link = loggedIn?.action?.options?.link;
    const { sourceUrl, merchantId } = useSafeResolvingContext();
    const clientId = clientIdStore((s) => s.clientId);
    const defaultAttribution = resolvingContextStore(
        (s) => s.backendSdkConfig?.attribution
    );

    const finalSharingLink = buildSharingLink({
        clientId: clientId ?? undefined,
        merchantId,
        baseUrl: link ?? sourceUrl,
        defaultAttribution,
    });

    return (
        <div
            className={cx(
                styles.modalListenerWallet__actionButtons,
                prefixWalletCss("modalListenerWallet__actionButtons")
            )}
        >
            <ButtonCopyLink
                finalSharingLink={finalSharingLink}
                merchantId={merchantId}
            />
            <ButtonSharingLink
                finalSharingLink={finalSharingLink}
                merchantId={merchantId}
            />
        </div>
    );
}

function ButtonCopyLink({
    finalSharingLink,
    merchantId,
}: {
    finalSharingLink: string | null;
    merchantId: string | undefined;
}) {
    const { copied, copy } = useCopyToClipboardWithState();
    const { t } = useListenerTranslation();
    const { mutate: trackSharing } = useTrackSharing();

    return (
        <ButtonWallet
            variant="primary"
            disabled={copied}
            isLoading={copied}
            icon={<Copy />}
            onClick={async () => {
                if (!finalSharingLink) return;
                copy(finalSharingLink);
                trackEvent("sharing_link_copied", {
                    source: "embedded_wallet",
                    merchant_id: merchantId,
                    link: finalSharingLink,
                });
                trackSharing();
                toast.success(t("sharing.btn.copySuccess"));
            }}
        >
            {t("sharing.btn.copy")}
        </ButtonWallet>
    );
}

function ButtonSharingLink({
    finalSharingLink,
    merchantId,
}: {
    finalSharingLink: string | null;
    merchantId: string | undefined;
}) {
    const { t } = useListenerTranslation();
    const { mutate: trackSharing } = useTrackSharing();

    // Trigger native sharing — hook auto-fires `sharing_link_shared`.
    const { mutate: triggerSharing, isPending: isSharing } = useShareLink(
        finalSharingLink,
        {
            title: t("sharing.title"),
            text: t("sharing.text"),
        },
        {
            source: "embedded_wallet",
            merchantId,
            onShared: () => trackSharing(),
            onSuccess: (message) => {
                message && toast.success(message as string);
            },
        }
    );

    return (
        <div
            className={cx(
                styles.modalListenerWallet__wrapperButton,
                prefixWalletCss("modalListenerWallet__wrapperButton")
            )}
        >
            <ButtonWallet
                variant="primary"
                disabled={isSharing}
                isLoading={isSharing}
                icon={<Share />}
                onClick={() => {
                    if (!finalSharingLink) return;
                    triggerSharing();
                }}
            >
                {t("sharing.btn.share")}
            </ButtonWallet>
            <OnboardingShare />
        </div>
    );
}
