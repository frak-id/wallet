import { Button } from "@frak-labs/design-system/components/Button";
import { ConfirmationTooltip } from "@frak-labs/design-system/components/ConfirmationTooltip";
import { ToastSurface } from "@frak-labs/design-system/components/ToastSurface";
import {
    authenticationStore,
    authenticatorStorage,
    recoveryHintStorage,
    trackEvent,
    ua,
    useLogin,
    useReferralStatus,
} from "@frak-labs/wallet-shared";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { EmailAlreadyUsedStep } from "@/module/onboarding/component/EmailAlreadyUsedStep";
import {
    type EmailAlreadyUsedArgs,
    EmailInputStep,
} from "@/module/onboarding/component/EmailInputStep";
import { NotificationOptIn } from "@/module/onboarding/component/NotificationOptIn";
import { OnboardingStep } from "@/module/onboarding/component/OnboardingStep";
import { ReferralCodeStep } from "@/module/onboarding/component/ReferralCodeStep";
import { onboardingSteps } from "@/module/onboarding/component/step/onboardingSteps";
import { Welcome } from "@/module/onboarding/component/Welcome";
import { useInstallReferrer } from "@/module/onboarding/hook/useInstallReferrer";
import { usePushOptIn } from "@/module/onboarding/hook/usePushOptIn";
import { useRegisterFlow } from "@/module/onboarding/hook/useRegisterFlow";
import { useSkipLatch } from "@/module/onboarding/hook/useSkipLatch";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./register.css";

type RegisterSearch = {
    /** Bypasses the "already has passkeys → /login" redirect guard when the
     * user explicitly chose to create a new account from a login surface. */
    new?: boolean;
    /** Pre-fills the onboarding email (from `/login/email` when the backend
     * can't resolve the typed email); skips ahead to `onboardingThree`. */
    email?: string;
};

export const Route = createFileRoute("/_wallet/_auth/register")({
    component: RegisterPage,
    validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
        new:
            search.new === true ||
            search.new === "true" ||
            search.new === "1" ||
            search.new === 1,
        email:
            typeof search.email === "string" && search.email.length > 0
                ? search.email
                : undefined,
    }),
    beforeLoad: async ({ search }) => {
        // Skip redirect if user explicitly requested new account creation
        if (search.new) return;

        // Synchronous localStorage signal, checked first: always ready at
        // `beforeLoad` (unlike the async IDB read below, which can be empty on
        // a cold-start race) and survives logout.
        const lastAuthenticator =
            authenticationStore.getState().lastAuthenticator;
        if (lastAuthenticator?.authenticatorId && lastAuthenticator?.address) {
            throw redirect({
                to: "/login",
                replace: true,
            });
        }

        // Passkeys stored locally → login.
        const previousAuthenticators = await authenticatorStorage.getAll();
        if (previousAuthenticators.length > 0) {
            throw redirect({
                to: "/login",
                replace: true,
            });
        }

        // Fresh install: fall back to the uninstall-resilient recovery hint
        // (iCloud KV / Block Store) — a match means the user had a wallet on
        // this Apple/Google account, so send them to login, not register.
        const hint = await recoveryHintStorage.get();
        if (hint.lastAuthenticatorId && hint.lastWallet) {
            throw redirect({
                to: "/login",
                replace: true,
            });
        }
    },
});

type ToastState = "idle" | "shown" | "leaving";

// Visible duration for the referral-code success toast.
const REFERRAL_TOAST_VISIBLE_MS = 4000;
// Matches `ConfirmationTooltip`'s 200ms exit animation + buffer.
const TOAST_EXIT_MS = 220;

function RegisterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { email: prefilledEmail } = Route.useSearch();
    const [loginError, setLoginError] = useState<Error | null>(null);
    // The skip control lives in each asking step's header slot, so its
    // disabled state has to come from the step rather than from inside it.
    // Each step reports its own state and clears the flag when it unmounts.
    const [isStepBusy, setIsStepBusy] = useState(false);
    // Step state machine, transition helper, and per-step analytics tracking.
    const { step, stepRef, goToStep, flowRef } = useRegisterFlow({
        prefilledEmail,
        onBeforeTransition: () => setLoginError(null),
    });
    // Hold the email collected on the `emailInput` step. Stays in component
    // state so navigating back to the step pre-fills the field, and is
    // forwarded to the register endpoint when the user activates their
    // secure space.
    const [email, setEmail] = useState(prefilledEmail ?? "");
    // Captured on the `emailAlreadyUsed` step so the dedicated screen knows
    // which credential to log in with. Cleared once the user navigates back
    // to the input step.
    const [alreadyUsed, setAlreadyUsed] = useState<EmailAlreadyUsedArgs | null>(
        null
    );

    // Detect pairing context once at mount: user landed on /register
    // because they hit a /pairing?id=xxx deep link before authenticating
    // (the pending navigation action is stored by
    // _wallet/_protected-fullscreen.tsx). When true, skip non-essential
    // onboarding steps so the user can confirm the pairing ASAP.
    const [isPairingContext] = useState(() => {
        const actions = pendingActionsStore.getState().getValidActions();
        return actions.some(
            (a) =>
                a.type === "navigation" && a.to === "/pairing" && !!a.search?.id
        );
    });

    const [referralToast, setReferralToast] = useState<ToastState>("idle");

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
                onExit: () => navigate({ to: "/register", replace: true }),
            });
        }
    }, [referrerData, openModal, navigate]);

    const advanceAfterKeypass = useCallback(() => {
        closeModal();
        // Drain logical pending actions (ensure calls) immediately after auth.
        // Navigation actions are deferred until after the welcome screen.
        executePendingActions({ skipNavigation: true });
        // In pairing context, skip referral + notification steps and jump
        // straight to the welcome screen so the user can confirm the
        // pairing as soon as possible.
        goToStep(isPairingContext ? "welcome" : "referralCode");
    }, [closeModal, executePendingActions, goToStep, isPairingContext]);

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
        onError: (error) => setLoginError(error),
    });

    const handleAlreadyHaveAccount = useCallback(() => {
        flowRef.current?.track("onboarding_action_clicked", {
            action: "login",
        });
        if (ua.isMobile) {
            setLoginError(null);
            login({});
            return;
        }
        navigate({ to: "/login" });
    }, [login, navigate]);

    // Notification opt-in handlers + auto-skip effect (subscribe side-effect
    // and `notification_opt_in_resolved` tracking live in the hook).
    const { onEnable: onEnablePush, onSkip: onSkipPush } = usePushOptIn({
        step,
        flowRef,
        goToStep,
    });

    // Auto-skip referral step if the user already has an applied referrer
    // (e.g. install-referrer resolved before the user reaches this screen).
    useEffect(() => {
        if (step !== "referralCode" || !hasExistingReferrer) return;
        flowRef.current?.track("referral_code_resolved", {
            outcome: "auto_skipped_existing",
        });
        goToStep("notification");
    }, [step, hasExistingReferrer, goToStep]);

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

    const handleOpenKeypass = useCallback(
        (emailOverride?: string) => {
            flowRef.current?.track("onboarding_action_clicked", {
                action: "activate_secure_space",
            });
            openModal({
                id: "keypass",
                onAuthSuccess: advanceAfterKeypass,
                // `undefined` means "use whatever was collected"; an explicit
                // empty string means the user skipped, so send no email.
                email: (emailOverride ?? email) || undefined,
            });
        },
        [openModal, advanceAfterKeypass, email]
    );

    // The redemption mutation is not unmount-cancelled, so a slow success can
    // land after the user already skipped the step. Ignore it then — the flow
    // has moved on and re-driving it would yank the user backwards.
    const handleReferralApplied = useCallback(() => {
        if (stepRef.current !== "referralCode") return;
        flowRef.current?.track("referral_code_resolved", {
            outcome: "applied",
        });
        setReferralToast("shown");
        goToStep("notification");
    }, [goToStep, stepRef]);

    const handleReferralSkip = useCallback(() => {
        flowRef.current?.track("referral_code_resolved", {
            outcome: "skipped",
        });
        goToStep("notification");
    }, [goToStep]);

    // Same stale-step guard as the applied path: a redemption that fails after
    // the user skipped must not emit a second resolution for the step.
    const handleReferralError = useCallback(
        (errorKey: string) => {
            if (stepRef.current !== "referralCode") return;
            flowRef.current?.track("referral_code_resolved", {
                outcome: "error",
                error_key: errorKey,
            });
        },
        [stepRef]
    );

    const handleEmailSkip = useCallback(() => {
        flowRef.current?.track("email_input_resolved", {
            outcome: "skipped",
        });
        // No email captured: the keypass registration accepts `undefined`,
        // and the wallet keeps prompting for one after onboarding.
        setEmail("");
        // Mirrors the submit path: pairing context goes straight to keypass
        // so the user can confirm the pairing, everyone else sees the
        // secure-space step first.
        if (isPairingContext) {
            handleOpenKeypass("");
            return;
        }
        goToStep("onboardingThree");
    }, [goToStep, handleOpenKeypass, isPairingContext]);

    const guardSkip = useSkipLatch(step);

    // One control, one label, reused by every step that asks for something.
    const renderSkip = (onSkip: () => void) => (
        <Button
            type="button"
            variant="secondary"
            size="small"
            width="auto"
            disabled={isStepBusy}
            onClick={() => guardSkip(onSkip)}
        >
            {t("onboarding.skipStep")}
        </Button>
    );

    return (
        <>
            {step === "onboardingOne" && (
                <OnboardingStep
                    hero={{
                        ...onboardingSteps[0],
                        imageWrapper: (img) => (
                            <DemoTapZone navigate={navigate}>{img}</DemoTapZone>
                        ),
                    }}
                    buttonLabel={t("onboarding.start")}
                    onContinue={() =>
                        goToStep(
                            isPairingContext ? "emailInput" : "onboardingTwo"
                        )
                    }
                    loginLabel={t("onboarding.alreadyHaveAccount")}
                    onLoginClick={handleAlreadyHaveAccount}
                    isLoginLoading={isLoginLoading}
                    loginError={loginError}
                    onRecoveryCodeClick={() => {
                        trackEvent("auth_recovery_code_clicked");
                        flowRef.current?.track("onboarding_action_clicked", {
                            action: "recovery_code",
                        });
                        navigate({ to: "/recovery-code" });
                    }}
                />
            )}
            {step === "onboardingTwo" && (
                <OnboardingStep
                    hero={onboardingSteps[1]}
                    buttonLabel={t("onboarding.continue")}
                    onContinue={() => goToStep("emailInput")}
                    onBack={() => goToStep("onboardingOne", "backward")}
                />
            )}
            {step === "emailInput" && (
                <EmailInputStep
                    initialValue={email}
                    headerEnd={renderSkip(handleEmailSkip)}
                    onBusyChange={setIsStepBusy}
                    onContinue={(value) => {
                        setEmail(value);
                        flowRef.current?.track("email_input_resolved", {
                            outcome: "submitted",
                        });
                        if (isPairingContext) {
                            handleOpenKeypass(value);
                        } else {
                            goToStep("onboardingThree");
                        }
                    }}
                    onBack={() => {
                        flowRef.current?.track("email_input_resolved", {
                            outcome: "back",
                        });
                        goToStep(
                            isPairingContext
                                ? "onboardingOne"
                                : "onboardingTwo",
                            "backward"
                        );
                    }}
                    onAlreadyUsed={(args) => {
                        setEmail(args.email);
                        setAlreadyUsed(args);
                        flowRef.current?.track("email_input_resolved", {
                            outcome: "already_used",
                        });
                        goToStep("emailAlreadyUsed");
                    }}
                />
            )}
            {step === "emailAlreadyUsed" && alreadyUsed && (
                <EmailAlreadyUsedStep
                    email={alreadyUsed.email}
                    isLoginLoading={isLoginLoading}
                    onLogin={() => {
                        flowRef.current?.track("onboarding_action_clicked", {
                            action: "login",
                        });
                        setLoginError(null);
                        // Pass every credential id bound to the resolved
                        // wallet to WebAuthn's `allowCredentials` — a wallet
                        // routinely accepts multiple passkeys post-merge.
                        // No `lastAuthentication` here: that store is per
                        // device, and the resolution we have is from the
                        // server, not the local hint cache.
                        login(
                            alreadyUsed.authenticatorIds.length > 0
                                ? {
                                      allowedCredentialIds:
                                          alreadyUsed.authenticatorIds,
                                  }
                                : {}
                        );
                    }}
                    onBack={() => {
                        setAlreadyUsed(null);
                        goToStep("emailInput", "backward");
                    }}
                    loginError={loginError}
                />
            )}
            {step === "onboardingThree" && (
                <OnboardingStep
                    hero={onboardingSteps[2]}
                    buttonLabel={t("onboarding.activateSecureSpace")}
                    onContinue={() => handleOpenKeypass()}
                    onBack={() => goToStep("emailInput", "backward")}
                />
            )}
            {step === "referralCode" && !hasExistingReferrer && (
                <ReferralCodeStep
                    onApplied={handleReferralApplied}
                    onError={handleReferralError}
                    headerEnd={renderSkip(handleReferralSkip)}
                    onBusyChange={setIsStepBusy}
                />
            )}
            {step === "notification" && (
                <NotificationOptIn
                    onEnable={onEnablePush}
                    headerEnd={renderSkip(onSkipPush)}
                    onBusyChange={setIsStepBusy}
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
