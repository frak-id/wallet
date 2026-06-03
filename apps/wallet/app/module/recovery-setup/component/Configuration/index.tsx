import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { useTestRecoveryPassword } from "@/module/recovery-setup/hook/useTestRecoveryPassword";
import * as styles from "../SetupFlow/styles.css";

type RecoveryConfigurationProps = {
    onBack: () => void;
};

export function RecoveryConfiguration({ onBack }: RecoveryConfigurationProps) {
    const { t, i18n } = useTranslation();
    const formId = useId();
    const { recoverySetupStatus } = useRecoverySetupStatus();
    const { testPasswordAsync, isPending } = useTestRecoveryPassword();
    const [password, setPassword] = useState("");
    const [result, setResult] = useState<"valid" | "invalid" | null>(null);

    const formatter = useMemo(
        () =>
            new Intl.DateTimeFormat(
                i18n.language?.startsWith("fr") ? "fr-FR" : "en-US",
                { dateStyle: "long" }
            ),
        [i18n.language]
    );

    const handleTest = async () => {
        setResult(null);
        const valid = await testPasswordAsync({ password });
        setResult(valid ? "valid" : "invalid");
    };

    return (
        <PageLayout back={<Back onClick={onBack} />}>
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">
                        {t("wallet.recoverySetup.config.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.recoverySetup.config.description")}
                    </Text>
                </Stack>

                <Card variant="muted" padding="default">
                    <Stack space="s">
                        <ConfigRow
                            label={t("wallet.recoverySetup.config.statusLabel")}
                            value={
                                <Badge variant="success">
                                    {t("wallet.recoverySetup.config.active")}
                                </Badge>
                            }
                        />
                        {recoverySetupStatus && (
                            <>
                                <ConfigRow
                                    label={t(
                                        "wallet.recoverySetup.config.startLabel"
                                    )}
                                    value={formatter.format(
                                        new Date(
                                            recoverySetupStatus.validAfter *
                                                1000
                                        )
                                    )}
                                />
                                <ConfigRow
                                    label={t(
                                        "wallet.recoverySetup.config.endLabel"
                                    )}
                                    value={
                                        recoverySetupStatus.validUntil
                                            ? formatter.format(
                                                  new Date(
                                                      recoverySetupStatus.validUntil *
                                                          1000
                                                  )
                                              )
                                            : t(
                                                  "wallet.recoverySetup.config.never"
                                              )
                                    }
                                />
                            </>
                        )}
                    </Stack>
                </Card>

                <Stack space="s">
                    <Text variant="bodySmall" weight="medium">
                        {t("wallet.recoverySetup.config.testTitle")}
                    </Text>
                    <Text variant="caption" color="tertiary">
                        {t("wallet.recoverySetup.config.testDescription")}
                    </Text>
                    <form
                        id={formId}
                        className={styles.form}
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleTest();
                        }}
                    >
                        <Input
                            type="password"
                            variant="bare"
                            tone="muted"
                            length="big"
                            autoComplete="off"
                            placeholder={t(
                                "wallet.recoverySetup.config.testPlaceholder"
                            )}
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                setResult(null);
                            }}
                        />
                        <Button
                            type="submit"
                            variant="secondary"
                            size="large"
                            width="full"
                            loading={isPending}
                            disabled={isPending || password.length === 0}
                        >
                            {t("wallet.recoverySetup.config.testButton")}
                        </Button>
                    </form>
                    {result === "valid" && (
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.recoverySetup.config.testValid")}
                        </Text>
                    )}
                    {result === "invalid" && (
                        <Text variant="bodySmall" color="error">
                            {t("wallet.recoverySetup.config.testInvalid")}
                        </Text>
                    )}
                </Stack>
            </Stack>
        </PageLayout>
    );
}

function ConfigRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            gap="s"
        >
            <Text variant="bodySmall" color="secondary">
                {label}
            </Text>
            {typeof value === "string" ? (
                <Text variant="bodySmall" weight="medium">
                    {value}
                </Text>
            ) : (
                value
            )}
        </Box>
    );
}
