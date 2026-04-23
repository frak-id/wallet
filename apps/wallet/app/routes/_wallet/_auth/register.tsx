import {
    authenticatorStorage,
    type Flow,
    startFlow,
    trackEvent,
    useLogin,
} from "@frak-labs/wallet-shared";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { NotificationOptIn } from "@/module/onboarding/component/NotificationOptIn";
import { Onboarding } from "@/module/onboarding/component/Onboarding";
import {
    onboardingSlides,
    Slide,
} from "@/module/onboarding/component/slides/OnboardingSlides";
import { Welcome } from "@/module/onboarding/component/Welcome";
import { useInstallReferrer } from "@/module/onboarding/hook/useInstallReferrer";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";
import { modalStore } from "@/module/stores/modalStore";

export const Route = createFileRoute("/_wallet/_auth/register")({
    component: RegisterPage,
    beforeLoad: async ({ location }) => {
        // Skip redirect if user explicitly requested new account creation
        const search = new URLSearchParams(location.search);
        if (search.has("new")) return;

        // If the user already has passkeys stored, redirect to login
        const previousAuthenticators = await authenticatorStorage.getAll();
        if (previousAuthenticators.length > 0) {
            throw redirect({
                to: "/login",
                replace: true,
            });
        }
    },
});

type FlowStep = "onboarding" | "notification" | "welcome";

function RegisterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState<FlowStep>("onboarding");
    const flowRef = useRef<Flow | null>(null);

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

    const advanceToNotification = useCallback(() => {
        closeModal();
        // Drain logical pending actions (ensure calls) immediately after auth.
        // Navigation actions are deferred until after the welcome screen.
        executePendingActions({ skipNavigation: true });
        setStep("notification");
    }, [closeModal, executePendingActions]);

    const { login, isLoading: isLoginLoading } = useLogin({
        onSuccess: advanceToNotification,
    });

    const { permissionStatus, permissionGranted, hasBackendToken } =
        useNotificationStatus();
    const { subscribeToPushAsync } = useSubscribeToPushNotification();

    // Fire `notification_opt_in_viewed` once we land on that step
    useEffect(() => {
        if (step === "notification") {
            flowRef.current?.track("notification_opt_in_viewed");
        }
    }, [step]);

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
        // Blur active element before opening drawer to prevent
        // aria-hidden conflict with focused element inside #root
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        flowRef.current?.track("onboarding_action_clicked", {
            action: "activate_secure_space",
        });
        openModal({
            id: "keypass",
            onAuthSuccess: advanceToNotification,
        });
    }, [openModal, advanceToNotification]);

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
                    onLoginClick={() => {
                        flowRef.current?.track("onboarding_action_clicked", {
                            action: "login",
                        });
                        login();
                    }}
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
        </>
    );
}
