import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { useDateFormatter } from "@/module/common/hook/useDateFormatter";
import { SummaryRow } from "@/module/recovery-setup/component/SummaryRow";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { useTestRecoveryPassword } from "@/module/recovery-setup/hook/useTestRecoveryPassword";
import * as styles from "../SetupFlow/styles.css";

type RecoveryConfigurationProps = {
    onBack: () => void;
    /** Keep the same burner, change only the on-chain validity dates. */
    onUpdateDates: () => void;
    /** Mint a fresh burner and replace the stored backup. */
    onReplaceKey: () => void;
};

export function RecoveryConfiguration({
    onBack,
    onUpdateDates,
    onReplaceKey,
}: RecoveryConfigurationProps) {
    const { t } = useTranslation();
    const formId = useId();
    const { recoverySetupStatus } = useRecoverySetupStatus();
    const { testPasswordAsync, isPending } = useTestRecoveryPassword();
    const [password, setPassword] = useState("");
    const [result, setResult] = useState<"valid" | "invalid" | null>(null);
    const formatter = useDateFormatter();

    const handleTest = async () => {
        setResult(null);
        const valid = await testPasswordAsync({ password });
        setResult(valid ? "valid" : "invalid");
    };

    return (
        <FlowStepScreen
            title={t("wallet.recoverySetup.config.title")}
            description={t("wallet.recoverySetup.config.description")}
            onBack={onBack}
        >
            <Card variant="muted" padding="default">
                <Stack space="s">
                    <SummaryRow
                        label={t("wallet.recoverySetup.config.statusLabel")}
                        value={
                            <Badge variant="success">
                                {t("wallet.recoverySetup.config.active")}
                            </Badge>
                        }
                    />
                    {recoverySetupStatus && (
                        <>
                            <SummaryRow
                                label={t(
                                    "wallet.recoverySetup.config.startLabel"
                                )}
                                value={formatter.format(
                                    new Date(
                                        recoverySetupStatus.validAfter * 1000
                                    )
                                )}
                            />
                            <SummaryRow
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
                                        : t("wallet.recoverySetup.config.never")
                                }
                            />
                        </>
                    )}
                </Stack>
            </Card>

            <Stack space="s">
                <Text variant="bodySmall" weight="medium">
                    {t("wallet.recoverySetup.config.refreshTitle")}
                </Text>
                <Text variant="caption" color="tertiary">
                    {t("wallet.recoverySetup.config.refreshDescription")}
                </Text>
                <Button
                    type="button"
                    variant="secondary"
                    size="large"
                    width="full"
                    onClick={onUpdateDates}
                >
                    {t("wallet.recoverySetup.config.updateDatesAction")}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="large"
                    width="full"
                    onClick={onReplaceKey}
                >
                    {t("wallet.recoverySetup.config.replaceKeyAction")}
                </Button>
            </Stack>

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
                    <PasswordInput
                        toggleLabel={t("wallet.recoverySetup.password.toggle")}
                        placeholder={t(
                            "wallet.recoverySetup.config.testPlaceholder"
                        )}
                        autoComplete="off"
                        value={password}
                        onChange={(value) => {
                            setPassword(value);
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
        </FlowStepScreen>
    );
}
