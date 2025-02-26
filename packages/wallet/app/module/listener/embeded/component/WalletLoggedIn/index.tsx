import { trackEvent } from "@/module/common/utils/trackEvent";
import { useSafeResolvingContext } from "@/module/listener/atoms/resolvingContext";
import { ButtonWallet } from "@/module/listener/embeded/component/ButtonWallet";
import {
    OnboardingActivate,
    OnboardingShare,
    OnboardingWelcome,
} from "@/module/listener/embeded/component/Onboarding";
import { useTriggerPushInterraction } from "@/module/listener/hooks/useTriggerPushInterraction";
import {
    useEmbededListenerUI,
    useListenerTranslation,
} from "@/module/listener/providers/ListenerUiProvider";
import { useGetUserBalance } from "@/module/tokens/hook/useGetUserBalance";
import { useCloseSession } from "@/module/wallet/hook/useCloseSession";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";
import { FrakContextManager } from "@frak-labs/core-sdk";
import { Copy } from "@shared/module/asset/icons/Copy";
import { Power } from "@shared/module/asset/icons/Power";
import { Share } from "@shared/module/asset/icons/Share";
import { useCopyToClipboardWithState } from "@shared/module/hook/useCopyToClipboardWithState";
import { useMutation } from "@tanstack/react-query";
import { tryit } from "radash";
import { useAccount } from "wagmi";
import styles from "./index.module.css";
const isOnboarding = true;

/**
 * View for the logged in user
 * @constructor
 */
export function LoggedInComponent() {
    return (
        <>
            <Balance />
            <ActionButtons />
        </>
    );
}

function Balance() {
    const { t } = useListenerTranslation();
    const { userBalance } = useGetUserBalance();

    return (
        <div className={styles.balance}>
            <h2 className={styles.balance__title}>
                {t("common.balance")}{" "}
                {/* <span className={styles.balance__status}>
                    ({t("common.pending")})
                </span> */}
            </h2>
            <p className={styles.balance__amount}>
                {userBalance?.eurBalance?.toFixed(2) ?? 0}€
            </p>
            {isOnboarding && <OnboardingWelcome />}
        </div>
    );
}

function ActionButtons() {
    const { address } = useAccount();
    const {
        currentRequest: {
            params: { loggedIn },
        },
    } = useEmbededListenerUI();
    const link = loggedIn?.action?.options?.link;
    const { sourceUrl } = useSafeResolvingContext();

    // Ensure the sharing link contain the current nexus wallet as referrer
    const finalSharingLink = FrakContextManager.update({
        url: link ?? sourceUrl,
        context: {
            r: address,
        },
    });

    return (
        <div className={styles.modalListenerWallet__actionButtons}>
            <ButtonOpenSession />
            <ButtonCopyLink finalSharingLink={finalSharingLink} />
            <ButtonSharingLink finalSharingLink={finalSharingLink} />
        </div>
    );
}

function ButtonOpenSession() {
    const { data: currentSession } = useInteractionSessionStatus();
    const { t } = useListenerTranslation();
    const { mutate: openSession, isPending: isOpeningSession } =
        useOpenSession();
    const { mutate: closeSession, isPending: isClosingSession } =
        useCloseSession();

    return (
        <div className={styles.modalListenerWallet__wrapperButton}>
            <ButtonWallet
                variant={currentSession ? "success" : "danger"}
                icon={<Power />}
                onClick={() => {
                    if (currentSession) {
                        closeSession();
                        trackEvent("cta-close-session");
                        return;
                    }

                    openSession();
                    trackEvent("cta-open-session");
                }}
                isLoading={isOpeningSession || isClosingSession}
                disabled={isOpeningSession || isClosingSession}
            >
                {currentSession ? t("common.activated") : t("common.disabled")}
            </ButtonWallet>
            {isOnboarding && (
                <OnboardingActivate
                    isReverse={true}
                    isHidden={!!currentSession}
                />
            )}
        </div>
    );
}

function ButtonCopyLink({
    finalSharingLink,
}: {
    finalSharingLink: string | null;
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
                trackEvent("sharing-copy-link", { link: finalSharingLink });
            }}
        >
            {t(copied ? "sharing.btn.copySuccess" : "sharing.btn.copy")}
        </ButtonWallet>
    );
}

function ButtonSharingLink({
    finalSharingLink,
}: {
    finalSharingLink: string | null;
}) {
    const { data: currentSession } = useInteractionSessionStatus();
    const {
        currentRequest: {
            params: { loggedIn },
        },
    } = useEmbededListenerUI();
    const options = loggedIn?.action?.options;
    const { t } = useListenerTranslation();

    // Trigger native sharing
    const {
        data: shareResult,
        mutate: triggerSharing,
        isPending: isSharing,
    } = useMutation({
        mutationKey: [
            "wallet-embedded",
            "sharing",
            "system-sharing",
            finalSharingLink,
        ],
        mutationFn: async () => {
            if (!finalSharingLink) return;

            // Build our sharing data
            const shareData = {
                title: options?.popupTitle ?? t("sharing.default.title"),
                text: options?.text ?? t("sharing.default.text"),
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
                    trackEvent("sharing-share-link", {
                        link: finalSharingLink,
                    });
                }}
            >
                {shareResult ?? t("sharing.btn.share")}
            </ButtonWallet>
            {isOnboarding && <OnboardingShare isHidden={!currentSession} />}
        </div>
    );
}
