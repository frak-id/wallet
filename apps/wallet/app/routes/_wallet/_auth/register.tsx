import {
    authenticatorStorage,
    isWebAuthNSupported,
    useLogin,
} from "@frak-labs/wallet-shared";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { isAuthenticatorAlreadyRegistered } from "@/module/authentication/lib/isAuthenticatorAlreadyRegistered";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { NotificationOptIn } from "@/module/onboarding/component/NotificationOptIn";
import { Onboarding } from "@/module/onboarding/component/Onboarding";
import {
    onboardingSlides,
    Slide,
} from "@/module/onboarding/component/slides/OnboardingSlides";
import { Welcome } from "@/module/onboarding/component/Welcome";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { usePendingPairingInfo } from "@/module/pairing/hook/usePendingPairingInfo";
import { modalStore } from "@/module/stores/modalStore";
import { consumePendingDeepLink } from "@/utils/deepLink";

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
    const { pairingInfo } = usePendingPairingInfo();
    const hasPendingPairing = Boolean(pairingInfo?.id);
    const [step, setStep] = useState<FlowStep>("onboarding");
    const [isRegistering, setIsRegistering] = useState(false);
    const { register, error, isSuccess } = useRegister({});

    const openModal = modalStore((s) => s.openModal);
    const closeModal = modalStore((s) => s.closeModal);

    const advanceToNotification = useCallback(() => {
        closeModal();
        setStep("notification");
    }, [closeModal]);

    const {
        login,
        isLoading: isLoginLoading,
        error: loginError,
    } = useLogin({
        onSuccess: advanceToNotification,
    });

    const isPreviouslyUsedAuthenticatorError = useMemo(
        () => !!error && isAuthenticatorAlreadyRegistered(error),
        [error]
    );

    useEffect(() => {
        if (error) setIsRegistering(false);
    }, [error]);

    useEffect(() => {
        if (isSuccess) {
            advanceToNotification();
        }
    }, [isSuccess, advanceToNotification]);

    const { permissionStatus, permissionGranted, hasBackendToken } =
        useNotificationStatus();
    const { subscribeToPushAsync } = useSubscribeToPushNotification();

    useEffect(() => {
        // Skip notification step if denied or already fully subscribed
        if (
            step === "notification" &&
            (permissionStatus === "denied" ||
                (permissionGranted && hasBackendToken))
        ) {
            setStep("welcome");
        }
    }, [step, permissionStatus, permissionGranted, hasBackendToken]);

    const handleOpenKeypass = useCallback(() => {
        // Blur active element before opening drawer to prevent
        // aria-hidden conflict with focused element inside #root
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        openModal({
            id: "keypass",
            onContinue: () => {
                if (isRegistering) return;
                setIsRegistering(true);
                register().catch(() => {});
            },
            isLoading: isRegistering,
            error: isPreviouslyUsedAuthenticatorError ? null : error,
            existingAccount: isPreviouslyUsedAuthenticatorError,
            isLoginLoading,
            loginError,
            onLogin: () => login(),
            webAuthNSupported: isWebAuthNSupported,
            onNavigateToLogin: () => navigate({ to: "/login", replace: true }),
        });
    }, [
        openModal,
        isRegistering,
        register,
        isPreviouslyUsedAuthenticatorError,
        error,
        isLoginLoading,
        loginError,
        login,
        navigate,
    ]);

    // Keep the keypass modal props in sync when reactive state changes
    const isKeypassOpen = modalStore((s) => s.modal?.id === "keypass");
    useEffect(() => {
        if (!isKeypassOpen) return;
        handleOpenKeypass();
    }, [isKeypassOpen, handleOpenKeypass]);

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
                    onLoginClick={() => login()}
                    isLoginLoading={isLoginLoading}
                    onRecoveryCodeClick={() =>
                        navigate({ to: "/recovery-code" })
                    }
                    onFinish={handleOpenKeypass}
                >
                    {onboardingSlides.map((slide) => (
                        <Slide key={slide.translationKey} {...slide} />
                    ))}
                </Onboarding>
            )}
            {step === "notification" && (
                <NotificationOptIn
                    onEnable={() =>
                        subscribeToPushAsync()
                            .then(() => setStep("welcome"))
                            .catch(() => setStep("welcome"))
                    }
                    onSkip={() => setStep("welcome")}
                />
            )}
            {step === "welcome" && (
                <Welcome
                    onContinue={() => {
                        if (consumePendingDeepLink(navigate)) return;
                        navigate({
                            to: hasPendingPairing ? "/pairing" : "/wallet",
                            replace: true,
                        });
                    }}
                />
            )}
        </>
    );
}
