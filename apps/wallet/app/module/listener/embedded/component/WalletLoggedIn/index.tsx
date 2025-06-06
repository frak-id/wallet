import { useSafeResolvingContext } from "@/module/listener/atoms/resolvingContext";
import { ButtonWallet } from "@/module/listener/embedded/component/ButtonWallet";
import {
    OnboardingActivate,
    OnboardingShare,
    OnboardingWelcome,
} from "@/module/listener/embedded/component/Onboarding";
import { useTriggerPushInterraction } from "@/module/listener/hooks/useTriggerPushInterraction";
import {
    useEmbeddedListenerUI,
    useListenerTranslation,
} from "@/module/listener/providers/ListenerUiProvider";
import { OriginPairingState } from "@/module/pairing/component/OriginPairingState";
import { useGetUserBalance } from "@/module/tokens/hook/useGetUserBalance";
import { useGetUserPendingBalance } from "@/module/tokens/hook/useGetUserPendingBalance";
import { useCloseSession } from "@/module/wallet/hook/useCloseSession";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";
import {
    type Currency,
    FrakContextManager,
    formatAmount,
    getCurrencyAmountKey,
} from "@frak-labs/core-sdk";
import { Copy } from "@shared/module/asset/icons/Copy";
import { Power } from "@shared/module/asset/icons/Power";
import { Share } from "@shared/module/asset/icons/Share";
import { useCopyToClipboardWithState } from "@shared/module/hook/useCopyToClipboardWithState";
import { useAccount } from "wagmi";
import { trackGenericEvent } from "../../../../common/analytics";
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
        <div className={styles.modalListenerWallet__footer}>
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
            {footer}
        </>
    );
}

function Balance({
    amount,
    isPending,
    currency,
}: { amount: number; isPending: boolean; currency: Currency }) {
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
}: { refetchPendingBalance: () => void }) {
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
        <div className={styles.modalListenerWallet__actionButtons}>
            <ButtonOpenSession refetchPendingBalance={refetchPendingBalance} />
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

function ButtonOpenSession({
    refetchPendingBalance,
}: { refetchPendingBalance: () => void }) {
    const { data: currentSession } = useInteractionSessionStatus();
    const { t } = useListenerTranslation();
    const { mutateAsync: openSession, isPending: isOpeningSession } =
        useOpenSession();
    const { mutateAsync: closeSession, isPending: isClosingSession } =
        useCloseSession();

    return (
        <div className={styles.modalListenerWallet__wrapperButton}>
            <ButtonWallet
                variant={currentSession ? "success" : "danger"}
                icon={<Power />}
                onClick={() => {
                    if (currentSession) {
                        closeSession().then(() => {
                            refetchPendingBalance();
                        });
                        return;
                    }

                    openSession().then(() => {
                        refetchPendingBalance();
                    });
                }}
                isLoading={isOpeningSession || isClosingSession}
                disabled={isOpeningSession || isClosingSession}
            >
                {currentSession ? t("common.activated") : t("common.disabled")}
            </ButtonWallet>
            <OnboardingActivate isReverse={true} isHidden={!!currentSession} />
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
    const { data: currentSession } = useInteractionSessionStatus();
    const { copied, copy } = useCopyToClipboardWithState();
    const { t } = useListenerTranslation();

    // Listen to copied to trigger the interaction push
    useTriggerPushInterraction({
        conditionToTrigger: copied,
    });

    return (
        <ButtonWallet
            variant={!currentSession ? "disabled" : "primary"}
            disabled={!currentSession}
            icon={<Copy />}
            onClick={async () => {
                if (!finalSharingLink) return;
                copy(finalSharingLink);
                trackGenericEvent("sharing-copy-link", {
                    link: finalSharingLink,
                });
                refetchPendingBalance();
            }}
        >
            {t(copied ? "sharing.btn.copySuccess" : "sharing.btn.copy")}
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
    const { data: currentSession } = useInteractionSessionStatus();
    const { t } = useListenerTranslation();

    // Trigger native sharing
    const {
        data: shareResult,
        mutate: triggerSharing,
        isPending: isSharing,
    } = useShareLink(finalSharingLink, {
        onSuccess: () => {
            refetchPendingBalance();
        },
    });

    // Listen to shareResult to trigger the interaction push
    useTriggerPushInterraction({
        conditionToTrigger: !!shareResult,
    });

    return (
        <div className={styles.modalListenerWallet__wrapperButton}>
            <ButtonWallet
                variant={!currentSession ? "disabled" : "primary"}
                disabled={!currentSession || isSharing}
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
                {shareResult ?? t("sharing.btn.share")}
            </ButtonWallet>
            <OnboardingShare isHidden={!currentSession} />
        </div>
    );
}
