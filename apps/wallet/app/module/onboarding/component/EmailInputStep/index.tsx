import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useCheckEmail } from "@/module/authentication/hook/useCheckEmail";
import {
    EmailFormScreen,
    emailFormScreenStyles,
} from "@/module/common/component/EmailFormScreen";

export type EmailExistingLoginArgs = {
    email: string;
    authenticatorId: string;
    wallet?: Address;
};

type EmailInputStepProps = {
    onContinue: (email: string) => void;
    onBack: () => void;
    /**
     * Called when the user opts to log in with the existing wallet attached
     * to the entered email. Receives the credential id + wallet returned by
     * the backend so the caller can run a targeted `useLogin` mutation.
     */
    onLoginExisting: (args: EmailExistingLoginArgs) => void;
    /** Reflects whether the parent login mutation is in-flight. */
    isLoginLoading?: boolean;
    initialValue?: string;
};

type AlreadyUsedState = {
    email: string;
    authenticatorId: string;
    wallet?: Address;
};

export function EmailInputStep({
    onContinue,
    onBack,
    onLoginExisting,
    isLoginLoading = false,
    initialValue = "",
}: EmailInputStepProps) {
    const { t } = useTranslation();
    const [alreadyUsed, setAlreadyUsed] = useState<AlreadyUsedState | null>(
        null
    );
    const {
        checkEmail,
        isChecking,
        error: checkError,
        reset,
    } = useCheckEmail();

    const clearTransientState = useCallback(() => {
        setAlreadyUsed(null);
        if (checkError) reset();
    }, [checkError, reset]);

    const handleSubmit = useCallback(
        async (email: string) => {
            try {
                const result = await checkEmail(email);
                if (result.used && result.authenticatorId) {
                    setAlreadyUsed({
                        email,
                        authenticatorId: result.authenticatorId,
                        wallet: result.wallet,
                    });
                    return;
                }
                onContinue(email);
            } catch {
                // Surface via `checkError` from the hook — caller stays on
                // the email step so the user can retry.
            }
        },
        [checkEmail, onContinue]
    );

    const handleLoginExisting = useCallback(() => {
        if (!alreadyUsed) return;
        onLoginExisting({
            email: alreadyUsed.email,
            authenticatorId: alreadyUsed.authenticatorId,
            wallet: alreadyUsed.wallet,
        });
    }, [alreadyUsed, onLoginExisting]);

    const showAlreadyUsed = alreadyUsed !== null;
    const showCheckError = !showAlreadyUsed && !!checkError;

    return (
        <EmailFormScreen
            title={t("onboarding.email.title")}
            description={t("onboarding.email.description")}
            label={t("onboarding.email.label")}
            placeholder={t("onboarding.email.placeholder")}
            clearAriaLabel={t("onboarding.email.clearAriaLabel")}
            submitLabel={t("onboarding.email.continue")}
            initialValue={initialValue}
            onBack={onBack}
            onSubmit={handleSubmit}
            isSubmitting={isChecking}
            submitDisabled={showAlreadyUsed}
            onEmailChange={clearTransientState}
        >
            {showAlreadyUsed && (
                <Box
                    className={emailFormScreenStyles.banner}
                    role="status"
                    aria-live="polite"
                >
                    <Text variant="body">
                        {t("onboarding.email.alreadyUsed.message")}
                    </Text>
                    <Button
                        type="button"
                        variant="primary"
                        size="medium"
                        width="full"
                        onClick={handleLoginExisting}
                        loading={isLoginLoading}
                    >
                        {t("onboarding.email.alreadyUsed.login")}
                    </Button>
                </Box>
            )}

            {showCheckError && (
                <Box role="alert" className={emailFormScreenStyles.inlineError}>
                    <Text variant="bodySmall" color="error">
                        {t("onboarding.email.checkError")}
                    </Text>
                </Box>
            )}
        </EmailFormScreen>
    );
}
