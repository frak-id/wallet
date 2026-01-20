import {
    type Currency,
    FrakContextManager,
    formatAmount,
    getCurrencyAmountKey,
} from "@frak-labs/core-sdk";
import { useCopyToClipboardWithState } from "@frak-labs/ui/hook/useCopyToClipboardWithState";
import { Copy } from "@frak-labs/ui/icons/Copy";
import { Share } from "@frak-labs/ui/icons/Share";
import { prefixWalletCss } from "@frak-labs/ui/utils/prefixWalletCss";
import {
    OriginPairingState,
    trackGenericEvent,
    useGetUserBalance,
    useGetUserPendingBalance,
} from "@frak-labs/wallet-shared";
import { cx } from "class-variance-authority";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { ButtonWallet } from "@/module/embedded/component/ButtonWallet";
import {
    OnboardingShare,
    OnboardingWelcome,
} from "@/module/embedded/component/Onboarding";
import { RewardHistory } from "@/module/embedded/component/RewardHistory";
import {
    useEmbeddedListenerUI,
    useListenerTranslation,
} from "@/module/providers/ListenerUiProvider";
import { useSafeResolvingContext } from "@/module/stores/hooks";
import { useShareLink } from "../../../hooks/useShareLink";
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
    const { userPendingBalance, refetch: refetchPendingBalance } =
        useGetUserPendingBalance();
    const currencyAmountKey = getCurrencyAmountKey(configMetadata?.currency);
    const isPending = !!(
        userPendingBalance?.[currencyAmountKey] &&
        userPendingBalance?.[currencyAmountKey] > 0
    );
    const amount = isPending
        ? userPendingBalance[currencyAmountKey]
        : (userBalance?.total?.[currencyAmountKey] ?? 0);

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
                isPending={isPending}
                currency={configMetadata?.currency ?? "eur"}
            />
            <ActionButtons refetchPendingBalance={refetchPendingBalance} />
            <RewardHistory />
            {footer}
        </>
    );
}

function Balance({
    amount,
    isPending,
    currency,
}: {
    amount: number;
    isPending: boolean;
    currency: Currency;
}) {
    const { t } = useListenerTranslation();

    return (
        <div className={styles.balance}>
            <h2 className={styles.balance__title}>
                {t("common.balance")}{" "}
                {isPending && (
                    <span className={styles.balance__status}>
                        ({t("common.pending")})
                    </span>
                )}
            </h2>
            <p className={styles.balance__amount}>
                {formatAmount(amount, currency)}
            </p>
            <OnboardingWelcome />
        </div>
    );
}

function ActionButtons({
    refetchPendingBalance,
}: {
    refetchPendingBalance: () => void;
}) {
    const { address } = useAccount();
    const {
        currentRequest: {
            params: { loggedIn },
        },
    } = useEmbeddedListenerUI();

    const link = loggedIn?.action?.options?.link;
    const { sourceUrl } = useSafeResolvingContext();

    // Ensure the sharing link contain the current frak wallet as referrer
    const finalSharingLink = FrakContextManager.update({
        url: link ?? sourceUrl,
        context: {
            r: address,
        },
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
                refetchPendingBalance={refetchPendingBalance}
            />
            <ButtonSharingLink
                finalSharingLink={finalSharingLink}
                refetchPendingBalance={refetchPendingBalance}
            />
        </div>
    );
}

function ButtonCopyLink({
    finalSharingLink,
    refetchPendingBalance,
}: {
    finalSharingLink: string | null;
    refetchPendingBalance: () => void;
}) {
    const { copied, copy } = useCopyToClipboardWithState();
    const { t } = useListenerTranslation();

    return (
        <ButtonWallet
            variant="primary"
            disabled={copied}
            isLoading={copied}
            icon={<Copy />}
            onClick={async () => {
                if (!finalSharingLink) return;
                copy(finalSharingLink);
                trackGenericEvent("sharing-copy-link", {
                    link: finalSharingLink,
                });
                refetchPendingBalance();
                toast.success(t("sharing.btn.copySuccess"));
            }}
        >
            {t("sharing.btn.copy")}
        </ButtonWallet>
    );
}

function ButtonSharingLink({
    finalSharingLink,
    refetchPendingBalance,
}: {
    finalSharingLink: string | null;
    refetchPendingBalance: () => void;
}) {
    const { t } = useListenerTranslation();

    // Trigger native sharing
    const { mutate: triggerSharing, isPending: isSharing } = useShareLink(
        finalSharingLink,
        {
            onSuccess: (message) => {
                refetchPendingBalance();
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
                    trackGenericEvent("sharing-share-link", {
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
