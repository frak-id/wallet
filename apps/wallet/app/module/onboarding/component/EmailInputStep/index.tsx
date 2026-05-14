import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon } from "@frak-labs/design-system/icons";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailInputStepProps = {
    onContinue: (email: string) => void;
    onBack: () => void;
    initialValue?: string;
};

export function EmailInputStep({
    onContinue,
    onBack,
    initialValue = "",
}: EmailInputStepProps) {
    const { t } = useTranslation();
    const [email, setEmail] = useState(initialValue);

    const trimmed = email.trim();
    const hasValue = trimmed.length > 0;
    const isValid = EMAIL_REGEX.test(trimmed);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
    };

    const handleClear = () => {
        setEmail("");
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
                    disabled={!isValid}
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
                        if (!isValid) return;
                        onContinue(trimmed);
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
            </Stack>
        </PageLayout>
    );
}
