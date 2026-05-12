import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon } from "@frak-labs/design-system/icons";
import {
    REDEMPTION_CODE_LENGTH,
    useRedeemReferralCodeForm,
} from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

type ReferralCodeStepProps = {
    onApplied: () => void;
    onSkip: () => void;
    onError?: (key: string) => void;
};

export function ReferralCodeStep({
    onApplied,
    onSkip,
    onError,
}: ReferralCodeStepProps) {
    const { t } = useTranslation();
    const {
        code,
        hasValue,
        canSubmit,
        isPending,
        errorMessageKey,
        handleChange,
        handleClear,
        handleSubmit,
    } = useRedeemReferralCodeForm({
        onApplied,
        onError,
        // Onboarding step allows submitting any non-empty value; the server
        // rejects short/invalid codes with a 422 we surface as an inline error.
        requireCompleteCode: false,
    });

    return (
        <PageLayout
            footer={
                <>
                    <Button
                        type="submit"
                        form="referral-code-step-form"
                        variant="primary"
                        size="large"
                        width="full"
                        disabled={!canSubmit}
                        loading={isPending}
                    >
                        {isPending ? null : t("onboarding.referral.submitCta")}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="small"
                        disabled={isPending}
                        onClick={onSkip}
                    >
                        {t("onboarding.referral.skip")}
                    </Button>
                </>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t("onboarding.referral.title")}</Title>
                    <Text variant="body" color="secondary">
                        {t("onboarding.referral.description")}
                    </Text>
                </Stack>

                <form id="referral-code-step-form" onSubmit={handleSubmit}>
                    <Stack space="xs">
                        <Box className={styles.labelRow}>
                            <Text
                                as="label"
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                            >
                                {t("onboarding.referral.label")}
                            </Text>
                        </Box>
                        <Input
                            variant="bare"
                            tone="muted"
                            length="big"
                            aria-label={t("onboarding.referral.label")}
                            placeholder={t("onboarding.referral.placeholder")}
                            autoFocus
                            autoCapitalize="characters"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="go"
                            maxLength={REDEMPTION_CODE_LENGTH}
                            error={Boolean(errorMessageKey)}
                            value={code}
                            onChange={handleChange}
                            rightSection={
                                hasValue ? (
                                    <Box
                                        as="button"
                                        type="button"
                                        aria-label={t("common.clear")}
                                        className={styles.clearButton}
                                        onClick={handleClear}
                                    >
                                        <CloseIcon />
                                    </Box>
                                ) : undefined
                            }
                        />
                        {errorMessageKey ? (
                            <Box className={styles.errorRow}>
                                <Text variant="caption" color="error">
                                    {t(errorMessageKey)}
                                </Text>
                            </Box>
                        ) : null}
                    </Stack>
                </form>
            </Stack>
        </PageLayout>
    );
}
