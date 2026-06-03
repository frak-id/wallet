import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Eye, EyeOff } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import {
    dateToValidAfter,
    dateToValidUntil,
    maxValidUntil,
} from "@/module/recovery-setup/utils/recoveryDates";
import * as styles from "./styles.css";

const MIN_PASSWORD_LENGTH = 8;

function toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
}

type PasswordStepProps = {
    onSubmit: (params: {
        password: string;
        validAfter: number;
        validUntil: number;
    }) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function PasswordStep({
    onSubmit,
    onBack,
    stepIndicator,
}: PasswordStepProps) {
    const { t } = useTranslation();
    const formId = useId();
    const [password, setPassword] = useState("");
    const [visible, setVisible] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const today = useMemo(() => toDateInputValue(new Date()), []);
    const maxDate = useMemo(
        () => toDateInputValue(new Date(maxValidUntil() * 1000)),
        []
    );

    const tooShort = password.length < MIN_PASSWORD_LENGTH;

    const handleSubmit = () => {
        if (tooShort) return;
        onSubmit({
            password,
            validAfter: dateToValidAfter(
                startDate ? new Date(startDate) : undefined
            ),
            validUntil: dateToValidUntil(
                endDate ? new Date(endDate) : undefined
            ),
        });
    };

    return (
        <PageLayout
            fixedViewport
            back={<Back onClick={onBack} />}
            headerCenter={stepIndicator}
            footer={
                <Button
                    type="submit"
                    form={formId}
                    variant="primary"
                    size="large"
                    width="full"
                    disabled={tooShort}
                >
                    {t("wallet.recoverySetup.password.continue")}
                </Button>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">
                        {t("wallet.recoverySetup.password.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.recoverySetup.password.description")}
                    </Text>
                </Stack>

                <form
                    id={formId}
                    className={styles.form}
                    onSubmit={(event) => {
                        event.preventDefault();
                        handleSubmit();
                    }}
                >
                    <Box className={styles.field}>
                        <Text
                            as="label"
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t("wallet.recoverySetup.password.label")}
                        </Text>
                        <Input
                            type={visible ? "text" : "password"}
                            variant="bare"
                            tone="muted"
                            length="big"
                            autoComplete="new-password"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder={t(
                                "wallet.recoverySetup.password.placeholder"
                            )}
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            rightSection={
                                <Box
                                    as="button"
                                    type="button"
                                    aria-label={t(
                                        "wallet.recoverySetup.password.toggle"
                                    )}
                                    onClick={() => setVisible((prev) => !prev)}
                                >
                                    {visible ? (
                                        <EyeOff size={16} />
                                    ) : (
                                        <Eye size={16} />
                                    )}
                                </Box>
                            }
                        />
                        <Text variant="caption" color="tertiary">
                            {t("wallet.recoverySetup.password.hint", {
                                min: MIN_PASSWORD_LENGTH,
                            })}
                        </Text>
                    </Box>

                    <Box className={styles.field}>
                        <Text
                            as="label"
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t("wallet.recoverySetup.password.startLabel")}
                        </Text>
                        <Input
                            type="date"
                            variant="bare"
                            tone="muted"
                            length="big"
                            min={today}
                            max={maxDate}
                            value={startDate}
                            onChange={(event) =>
                                setStartDate(event.target.value)
                            }
                        />
                        <Text variant="caption" color="tertiary">
                            {t("wallet.recoverySetup.password.startHelp")}
                        </Text>
                    </Box>

                    <Box className={styles.field}>
                        <Text
                            as="label"
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t("wallet.recoverySetup.password.endLabel")}
                        </Text>
                        <Input
                            type="date"
                            variant="bare"
                            tone="muted"
                            length="big"
                            min={today}
                            max={maxDate}
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                        />
                        <Text variant="caption" color="tertiary">
                            {t("wallet.recoverySetup.password.endHelp")}
                        </Text>
                    </Box>
                </form>

                <Card variant="muted" padding="default">
                    <Text variant="bodySmall" color="error">
                        {t("wallet.recoverySetup.password.warning")}
                    </Text>
                </Card>
            </Stack>
        </PageLayout>
    );
}
