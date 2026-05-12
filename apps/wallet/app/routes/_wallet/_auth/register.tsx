import { ConfirmationTooltip } from "@frak-labs/design-system/components/ConfirmationTooltip";
import { ToastSurface } from "@frak-labs/design-system/components/ToastSurface";
import {
    authenticatorStorage,
    type Flow,
    recoveryHintStorage,
    startFlow,
    trackEvent,
    ua,
    useLogin,
    useReferralStatus,
} from "@frak-labs/wallet-shared";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { NotificationOptIn } from "@/module/onboarding/component/NotificationOptIn";
import { Onboarding } from "@/module/onboarding/component/Onboarding";
import { ReferralCodeStep } from "@/module/onboarding/component/ReferralCodeStep";
import {
    onboardingSlides,
    Slide,
} from "@/module/onboarding/component/slides/OnboardingSlides";
import { Welcome } from "@/module/onboarding/component/Welcome";
import { useInstallReferrer } from "@/module/onboarding/hook/useInstallReferrer";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./register.css";

export const Route = createFileRoute("/_wallet/_auth/register")({
    component: RegisterPage,
    beforeLoad: async ({ location }) => {
        // Skip redirect if user explicitly requested new account creation
        const search = new URLSearchParams(location.search);
        if (search.has("new")) return;

        // If the user already has passkeys stored locally, redirect to login
        const previousAuthenticators = await authenticatorStorage.getAll();
        if (previousAuthenticators.length > 0) {
            throw redirect({
                to: "/login",
                replace: true,
            });
        }

        // Fresh install with no local state — still try the cross-platform
        // recovery hint (iCloud KV / Block Store). If we find one, the user
        // previously had a wallet on this Apple/Google account and should go
        // through the login flow instead of registering a new one.
        const hint = await recoveryHintStorage.get();
        if (hint.lastAuthenticatorId && hint.lastWallet) {
            throw redirect({
                to: "/login",
                replace: true,
            });
        }
    },
});

type FlowStep = "onboarding" | "referralCode" | "notification" | "welcome";

type ToastState = "idle" | "shown" | "leaving";

// Visible duration for the referral-code success toast.
const REFERRAL_TOAST_VISIBLE_MS = 4000;
// Matches `ConfirmationTooltip`'s 200ms exit animation + buffer.
const TOAST_EXIT_MS = 220;

function RegisterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState<FlowStep>("onboarding");
    const [referralToast, setReferralToast] = useState<ToastState>("idle");
    const flowRef = useRef<Flow | null>(null);

    const { data: referralStatus } = useReferralStatus();
    const hasExistingReferrer = Boolean(referralStatus?.crossMerchantReferrer);

    const openModal = modalStore((s) => s.openModal);
    const closeModal = modalStore((s) => s.closeModal);

    const { executePendingActions } = useExecutePendingActions();

    // On Tauri+Android: read Play Store referrer, resolve merchant, store ensure action
    const { data: referrerData } = useInstallReferrer();

    // Show merchant popup once referrer is resolved
    useEffect(() => {
        if (referrerData?.merchant) {
            openModal({
                id: "recoveryCodeSuccess",
                merchant: referrerData.merchant,
            });
        }
    }, [referrerData, openModal]);

    // Start the onboarding flow on mount, end as "abandoned" if never succeeded
    useEffect(() => {
        const flow = startFlow("onboarding");
        flowRef.current = flow;
        return () => {
            if (!flow.ended) flow.end("abandoned", { last_step: step });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const advanceToReferralCode = useCallback(() => {
        closeModal();
        // Drain logical pending actions (ensure calls) immediately after auth.
        // Navigation actions are deferred until after the welcome screen.
        executePendingActions({ skipNavigation: true });
        setStep("referralCode");
    }, [closeModal, executePendingActions]);

    // On mobile (where the QR-code option isn't offered on `/login`),
    // "Already have an account?" runs the login mutation inline. On the
    // web we still redirect to `/login` so the user can pick the dedicated
    // login UX (existing-account shortcut, connect another account, QR
    // pairing).
    const handlePostLoginRedirect = useCallback(async () => {
        const navigated = await executePendingActions();
        if (!navigated) {
            navigate({ to: "/wallet", replace: true });
        }
    }, [executePendingActions, navigate]);

    const { login, isLoading: isLoginLoading } = useLogin({
        onSuccess: handlePostLoginRedirect,
    });

    const handleAlreadyHaveAccount = useCallback(() => {
        flowRef.current?.track("onboarding_action_clicked", {
            action: "login",
        });
        if (ua.isMobile) {
            login({});
            return;
        }
        navigate({ to: "/login" });
    }, [login, navigate]);

    const { permissionStatus, permissionGranted, hasBackendToken } =
        useNotificationStatus();
    const { subscribeToPushAsync } = useSubscribeToPushNotification();

    // Fire `referral_code_viewed` once we land on that step
    useEffect(() => {
        if (step === "referralCode") {
            flowRef.current?.track("referral_code_viewed");
        }
    }, [step]);

    // Fire `notification_opt_in_viewed` once we land on that step
    useEffect(() => {
        if (step === "notification") {
            flowRef.current?.track("notification_opt_in_viewed");
        }
    }, [step]);

    // Auto-skip referral step if the user already has an applied referrer
    // (e.g. install-referrer resolved before the user reaches this screen).
    useEffect(() => {
        if (step !== "referralCode" || !hasExistingReferrer) return;
        flowRef.current?.track("referral_code_resolved", {
            outcome: "auto_skipped_existing",
        });
        setStep("notification");
    }, [step, hasExistingReferrer]);

    // Drive the referral-success toast lifecycle: shown → leaving → idle.
    useEffect(() => {
        if (referralToast === "idle") return;
        const delay =
            referralToast === "shown"
                ? REFERRAL_TOAST_VISIBLE_MS
                : TOAST_EXIT_MS;
        const next: ToastState = referralToast === "shown" ? "leaving" : "idle";
        const timeoutId = window.setTimeout(
            () => setReferralToast(next),
            delay
        );
        return () => window.clearTimeout(timeoutId);
    }, [referralToast]);

    // Auto-skip notification step if already granted or denied
    useEffect(() => {
        if (
            step !== "notification" ||
            !(
                permissionStatus === "denied" ||
                (permissionGranted && hasBackendToken)
            )
        )
            return;
        flowRef.current?.track("notification_opt_in_resolved", {
            outcome:
                permissionStatus === "denied"
                    ? "auto_skipped_denied"
                    : "auto_skipped_granted",
        });
        setStep("welcome");
    }, [step, permissionStatus, permissionGranted, hasBackendToken]);

    const handleOpenKeypass = useCallback(() => {
        flowRef.current?.track("onboarding_action_clicked", {
            action: "activate_secure_space",
        });
        openModal({
            id: "keypass",
            onAuthSuccess: advanceToReferralCode,
        });
    }, [openModal, advanceToReferralCode]);

    const handleReferralApplied = useCallback(() => {
        flowRef.current?.track("referral_code_resolved", {
            outcome: "applied",
        });
        setReferralToast("shown");
        setStep("notification");
    }, []);

    const handleReferralSkip = useCallback(() => {
        flowRef.current?.track("referral_code_resolved", {
            outcome: "skipped",
        });
        setStep("notification");
    }, []);

    const handleReferralError = useCallback((errorKey: string) => {
        flowRef.current?.track("referral_code_resolved", {
            outcome: "error",
            error_key: errorKey,
        });
    }, []);

    return (
        <>
            <DemoTapZone navigate={navigate} />
            <PairingInProgress />
            {step === "onboarding" && (
                <Onboarding
                    firstButtonLabel={t("onboarding.start")}
                    buttonLabel={t("onboarding.continue")}
                    lastButtonLabel={t("onboarding.activateSecureSpace")}
                    loginLabel={t("onboarding.alreadyHaveAccount")}
                    onLoginClick={handleAlreadyHaveAccount}
                    isLoginLoading={isLoginLoading}
                    onRecoveryCodeClick={() => {
                        trackEvent("auth_recovery_code_clicked");
                        flowRef.current?.track("onboarding_action_clicked", {
                            action: "recovery_code",
                        });
                        navigate({ to: "/recovery-code" });
                    }}
                    onFinish={handleOpenKeypass}
                    onSlideViewed={(index) => {
                        flowRef.current?.track("onboarding_slide_viewed", {
                            index,
                            translation_key:
                                onboardingSlides[index]?.translationKey ??
                                "unknown",
                        });
                    }}
                >
                    {onboardingSlides.map((slide) => (
                        <Slide key={slide.translationKey} {...slide} />
                    ))}
                </Onboarding>
            )}
            {step === "referralCode" && !hasExistingReferrer && (
                <ReferralCodeStep
                    onApplied={handleReferralApplied}
                    onSkip={handleReferralSkip}
                    onError={handleReferralError}
                />
            )}
            {step === "notification" && (
                <NotificationOptIn
                    onEnable={() => {
                        subscribeToPushAsync()
                            .then(() => {
                                flowRef.current?.track(
                                    "notification_opt_in_resolved",
                                    { outcome: "enabled" }
                                );
                                setStep("welcome");
                            })
                            .catch((err: unknown) => {
                                flowRef.current?.track(
                                    "notification_opt_in_resolved",
                                    {
                                        outcome: "denied",
                                        reason:
                                            err instanceof Error
                                                ? err.message
                                                : String(err),
                                    }
                                );
                                setStep("welcome");
                            });
                    }}
                    onSkip={() => {
                        flowRef.current?.track("notification_opt_in_resolved", {
                            outcome: "skipped",
                        });
                        setStep("welcome");
                    }}
                />
            )}
            {step === "welcome" && (
                <Welcome
                    onContinue={async () => {
                        flowRef.current?.end("succeeded");
                        // Drain navigation actions now that onboarding is done
                        const navigated = await executePendingActions();
                        if (!navigated) {
                            navigate({ to: "/wallet", replace: true });
                        }
                    }}
                />
            )}
            {/*
             * Rendered last so PageLayout's `:first-child` marginTop rule
             * stays stable as the toast mounts/unmounts. ToastSurface is
             * `position: absolute`, so render order does not affect layout.
             */}
            {referralToast !== "idle" ? (
                <ToastSurface className={styles.toastOffset}>
                    <ConfirmationTooltip
                        isLeaving={referralToast === "leaving"}
                    >
                        {t("onboarding.referral.appliedToast")}
                    </ConfirmationTooltip>
                </ToastSurface>
            ) : null}
        </>
    );
}
