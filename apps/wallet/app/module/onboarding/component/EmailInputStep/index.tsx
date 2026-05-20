import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon } from "@frak-labs/design-system/icons";
import { type ChangeEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useCheckEmail } from "@/module/authentication/hook/useCheckEmail";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const [email, setEmail] = useState(initialValue);
    const [alreadyUsed, setAlreadyUsed] = useState<AlreadyUsedState | null>(
        null
    );
    const {
        checkEmail,
        isChecking,
        error: checkError,
        reset,
    } = useCheckEmail();

    const trimmed = email.trim();
    const hasValue = trimmed.length > 0;
    const isValid = EMAIL_REGEX.test(trimmed);
    // Already-used banner is only meaningful while the email it was raised
    // for is still in the field — otherwise the user has typed past it.
    const showAlreadyUsed =
        !!alreadyUsed && alreadyUsed.email === trimmed.toLowerCase();
    const submitDisabled = !isValid || isChecking || showAlreadyUsed;

    const clearTransientState = useCallback(() => {
        setAlreadyUsed(null);
        if (checkError) reset();
    }, [checkError, reset]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        clearTransientState();
    };

    const handleClear = () => {
        setEmail("");
        clearTransientState();
    };

    const handleSubmit = async () => {
        if (!isValid || isChecking) return;
        try {
            const result = await checkEmail(trimmed);
            if (result.used && result.authenticatorId) {
                setAlreadyUsed({
                    email: trimmed.toLowerCase(),
                    authenticatorId: result.authenticatorId,
                    wallet: result.wallet,
                });
                return;
            }
            onContinue(trimmed);
        } catch {
            // Surface via `checkError` from the hook — caller stays on the
            // email step so the user can retry.
        }
    };

    const handleLoginExisting = () => {
        if (!alreadyUsed) return;
        onLoginExisting({
            email: trimmed,
            authenticatorId: alreadyUsed.authenticatorId,
            wallet: alreadyUsed.wallet,
        });
    };

    return (
        <PageLayout
            fixedViewport
            back={<Back onClick={onBack} />}
            footer={
                <Button
                    type="submit"
                    form="email-input-step-form"
                    variant="primary"
                    size="large"
                    width="full"
                    disabled={submitDisabled}
                    loading={isChecking}
                >
                    {t("onboarding.email.continue")}
                </Button>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t("onboarding.email.title")}</Title>
                    <Text variant="body" color="secondary">
                        {t("onboarding.email.description")}
                    </Text>
                </Stack>

                <form
                    id="email-input-step-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit();
                    }}
                >
                    <Stack space="xs">
                        <Box className={styles.labelRow}>
                            <Text
                                as="label"
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                            >
                                {t("onboarding.email.label")}
                            </Text>
                        </Box>
                        <Input
                            variant="bare"
                            tone="muted"
                            length="big"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="go"
                            autoFocus
                            aria-label={t("onboarding.email.label")}
                            placeholder={t("onboarding.email.placeholder")}
                            value={email}
                            onChange={handleChange}
                            rightSection={
                                hasValue ? (
                                    <Box
                                        as="button"
                                        type="button"
                                        aria-label={t(
                                            "onboarding.email.clearAriaLabel"
                                        )}
                                        className={styles.clearButton}
                                        onClick={handleClear}
                                    >
                                        <CloseIcon />
                                    </Box>
                                ) : undefined
                            }
                        />
                    </Stack>
                </form>

                {showAlreadyUsed && (
                    <Box
                        className={styles.alreadyUsedBlock}
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

                {!showAlreadyUsed && checkError && (
                    <Text
                        variant="bodySmall"
                        className={styles.checkError}
                    >
                        {t("onboarding.email.checkError")}
                    </Text>
                )}
            </Stack>
        </PageLayout>
    );
}