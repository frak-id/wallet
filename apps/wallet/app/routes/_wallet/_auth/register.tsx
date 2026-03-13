import {
    authenticatorStorage,
    isWebAuthNSupported,
    useLogin,
} from "@frak-labs/wallet-shared";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { isAuthenticatorAlreadyRegistered } from "@/module/authentication/lib/isAuthenticatorAlreadyRegistered";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { Keypass } from "@/module/onboarding/component/Keypass";
import { NotificationOptIn } from "@/module/onboarding/component/NotificationOptIn";
import { Onboarding } from "@/module/onboarding/component/Onboarding";
import { SlideOne } from "@/module/onboarding/component/slides/SlideOne";
import { SlideThree } from "@/module/onboarding/component/slides/SlideThree";
import { SlideTwo } from "@/module/onboarding/component/slides/SlideTwo";
import { Welcome } from "@/module/onboarding/component/Welcome";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { usePendingPairingInfo } from "@/module/pairing/hook/usePendingPairingInfo";
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

type FlowStep = "onboarding" | "keypass" | "notification" | "welcome";

function RegisterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { pairingInfo } = usePendingPairingInfo();
    const hasPendingPairing = Boolean(pairingInfo?.id);
    const [step, setStep] = useState<FlowStep>("onboarding");
    const [isRegistering, setIsRegistering] = useState(false);
    const { register, error, isSuccess } = useRegister({});
    const {
        login,
        isLoading: isLoginLoading,
        error: loginError,
    } = useLogin({
        onSuccess: () => setStep("notification"),
    });

    /**
     * Boolean used to know if the error is about a previously used authenticator
     */
    const isPreviouslyUsedAuthenticatorError = useMemo(
        () => !!error && isAuthenticatorAlreadyRegistered(error),
        [error]
    );

    useEffect(() => {
        if (error) setIsRegistering(false);
    }, [error]);

    useEffect(() => {
        if (isSuccess) setStep("notification");
    }, [isSuccess]);

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

    return (
        <>
            <DemoTapZone navigate={navigate} />
            <PairingInProgress />
            {step === "onboarding" && (
                <Onboarding
                    buttonLabel={t("onboarding.continue")}
                    lastButtonLabel={t("onboarding.activateSecureSpace")}
                    onFinish={() => setStep("keypass")}
                >
                    <SlideOne />
                    <SlideTwo />
                    <SlideThree />
                </Onboarding>
            )}
            {step === "keypass" && (
                <Keypass
                    onContinue={() => {
                        if (isRegistering) return;
                        setIsRegistering(true);
                        register().catch(() => {});
                    }}
                    isLoading={isRegistering}
                    error={isPreviouslyUsedAuthenticatorError ? null : error}
                    existingAccount={isPreviouslyUsedAuthenticatorError}
                    isLoginLoading={isLoginLoading}
                    loginError={loginError}
                    onLogin={() => login()}
                    webAuthNSupported={isWebAuthNSupported}
                    onNavigateToLogin={() =>
                        navigate({ to: "/login", replace: true })
                    }
                />
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
