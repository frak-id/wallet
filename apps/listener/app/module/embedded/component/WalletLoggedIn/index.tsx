import {
    type Currency,
    FrakContextManager,
    formatAmount,
    getCurrencyAmountKey,
    mergeAttribution,
} from "@frak-labs/core-sdk";
import {
    clientIdStore,
    OriginPairingState,
    trackEvent,
    useCopyToClipboardWithState,
    useGetUserBalance,
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
import { useShareLink } from "../../../hooks/useShareLink";
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

    const finalSharingLink =
        clientId && merchantId
            ? FrakContextManager.update({
                  url: link ?? sourceUrl,
                  context: {
                      v: 2,
                      c: clientId,
                      m: merchantId,
                      t: Math.floor(Date.now() / 1000),
                  },
                  attribution: mergeAttribution({
                      perCall: {},
                      defaults: defaultAttribution,
                  }),
              })
            : null;

    return (
        <div
            className={cx(
                styles.modalListenerWallet__actionButtons,
                prefixWalletCss("modalListenerWallet__actionButtons")
            )}
        >
            <ButtonCopyLink finalSharingLink={finalSharingLink} />
            <ButtonSharingLink finalSharingLink={finalSharingLink} />
        </div>
    );
}

function ButtonCopyLink({
    finalSharingLink,
}: {
    finalSharingLink: string | null;
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
}: {
    finalSharingLink: string | null;
}) {
    const { t } = useListenerTranslation();

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
                    trackEvent("sharing_link_shared", {
                        link: finalSharingLink,
                    });
                }}
            >
                {t("sharing.btn.share")}
            </ButtonWallet>
            <OnboardingShare />
        </div>
    );
}
