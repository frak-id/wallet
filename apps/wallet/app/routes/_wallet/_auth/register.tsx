import {
    authenticatorStorage,
    type Flow,
    type NotificationPermission,
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

    const advanceStep = useCallback((to: FlowStep, from: FlowStep) => {
        flowRef.current?.track("onboarding_step_advanced", { from, to });
        setStep(to);
    }, []);

    const advanceToNotification = useCallback(() => {
        closeModal();
        // Drain logical pending actions (ensure calls) immediately after auth.
        // Navigation actions are deferred until after the welcome screen.
        executePendingActions({ skipNavigation: true });
        advanceStep("notification", "onboarding");
    }, [closeModal, executePendingActions, advanceStep]);

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

    // Fire `notification_permission_resolved` once the permission is known
    const trackedPermissionRef = useRef(false);
    useEffect(() => {
        if (trackedPermissionRef.current || !permissionStatus) return;
        trackedPermissionRef.current = true;
        flowRef.current?.track("notification_permission_resolved", {
            permission: permissionStatus as NotificationPermission,
        });
    }, [permissionStatus]);

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
        flowRef.current?.track("notification_auto_skipped", {
            reason:
                permissionStatus === "denied"
                    ? "already_denied"
                    : "already_granted",
        });
        advanceStep("welcome", "notification");
    }, [
        step,
        permissionStatus,
        permissionGranted,
        hasBackendToken,
        advanceStep,
    ]);

    const handleOpenKeypass = useCallback(() => {
        // Blur active element before opening drawer to prevent
        // aria-hidden conflict with focused element inside #root
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        flowRef.current?.track("onboarding_action_clicked", {
            action: "activate_secure_space",
        });
        flowRef.current?.track("onboarding_keypass_opened");
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
                        flowRef.current?.track("notification_opt_in_enabled");
                        subscribeToPushAsync()
                            .then(() => advanceStep("welcome", "notification"))
                            .catch((err: unknown) => {
                                flowRef.current?.track(
                                    "notification_opt_in_denied",
                                    {
                                        reason:
                                            err instanceof Error
                                                ? err.message
                                                : String(err),
                                    }
                                );
                                advanceStep("welcome", "notification");
                            });
                    }}
                    onSkip={() => {
                        flowRef.current?.track("notification_opt_in_skipped");
                        advanceStep("welcome", "notification");
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
