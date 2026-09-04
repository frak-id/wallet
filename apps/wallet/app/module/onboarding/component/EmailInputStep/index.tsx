import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
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
    /** Header-end slot, right-aligned on the header row. */
    headerEnd?: ReactNode;
    /**
     * Reports whether the uniqueness check is in flight, so the parent can
     * disable the header skip while it runs.
     */
    onBusyChange?: (isBusy: boolean) => void;
};

export function EmailInputStep({
    onContinue,
    onBack,
    onAlreadyUsed,
    initialValue = "",
    headerEnd,
    onBusyChange,
}: EmailInputStepProps) {
    const { t } = useTranslation();
    const {
        checkEmail,
        isChecking,
        error: checkError,
        reset,
    } = useCheckEmail();

    // Clear on unmount too: leaving mid-check would otherwise strand the
    // parent's flag at `true` and disable the next step's skip.
    useEffect(() => {
        onBusyChange?.(isChecking);
        return () => onBusyChange?.(false);
    }, [isChecking, onBusyChange]);

    // The check resolves asynchronously; skipping unmounts this step while it
    // is still in flight. Without this guard the late resolution would drive a
    // transition out of whatever step the user moved on to.
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const clearTransientState = useCallback(() => {
        if (checkError) reset();
    }, [checkError, reset]);

    const handleSubmit = useCallback(
        async (email: string) => {
            try {
                const result = await checkEmail(email);
                if (!isMounted.current) return;
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
            headerEnd={headerEnd}
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
