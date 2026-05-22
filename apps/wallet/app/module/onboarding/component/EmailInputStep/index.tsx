import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useCheckEmail } from "@/module/authentication/hook/useCheckEmail";
import {
    EmailFormScreen,
    emailFormScreenStyles,
} from "@/module/common/component/EmailFormScreen";

export type EmailAlreadyUsedArgs = {
    email: string;
    authenticatorIds: string[];
    wallet?: Address;
};

type EmailInputStepProps = {
    onContinue: (email: string) => void;
    onBack: () => void;
    /**
     * Called when the entered email is already attached to another wallet.
     * The parent owns the screen transition — `EmailInputStep` only collects
     * the input and delegates the resolution path (login on the existing
     * wallet, switch email, etc.) to a dedicated screen above.
     */
    onAlreadyUsed: (args: EmailAlreadyUsedArgs) => void;
    initialValue?: string;
};

export function EmailInputStep({
    onContinue,
    onBack,
    onAlreadyUsed,
    initialValue = "",
}: EmailInputStepProps) {
    const { t } = useTranslation();
    const {
        checkEmail,
        isChecking,
        error: checkError,
        reset,
    } = useCheckEmail();

    const clearTransientState = useCallback(() => {
        if (checkError) reset();
    }, [checkError, reset]);

    const handleSubmit = useCallback(
        async (email: string) => {
            try {
                const result = await checkEmail(email);
                if (result.used && result.authenticatorIds.length > 0) {
                    onAlreadyUsed({
                        email,
                        authenticatorIds: result.authenticatorIds,
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
        [checkEmail, onContinue, onAlreadyUsed]
    );

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
            onEmailChange={clearTransientState}
        >
            {checkError && (
                <Box role="alert" className={emailFormScreenStyles.inlineError}>
                    <Text variant="bodySmall" color="error">
                        {t("onboarding.email.checkError")}
                    </Text>
                </Box>
            )}
        </EmailFormScreen>
    );
}
