import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    ChevronRightIcon,
    RefreshIcon,
    ShieldIcon,
} from "@frak-labs/design-system/icons";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { useDateFormatter } from "@/module/common/hook/useDateFormatter";
import { SummaryRow } from "@/module/recovery-setup/component/SummaryRow";
import { useConnectedWalletRecovery } from "@/module/recovery-setup/hook/useConnectedWalletRecovery";
import { useTestRecoveryPassword } from "@/module/recovery-setup/hook/useTestRecoveryPassword";
import * as formStyles from "../SetupFlow/styles.css";
import * as styles from "./styles.css";

type RecoveryConfigurationProps = {
    onBack: () => void;
    /** Keep the same burner, change only the on-chain validity dates. */
    onUpdateDates: () => void;
    /** Mint a fresh burner and replace the stored backup. */
    onReplaceKey: () => void;
    /** Disable recovery on-chain and delete the stored backup. */
    onDelete: () => void;
};

export function RecoveryConfiguration({
    onBack,
    onUpdateDates,
    onReplaceKey,
    onDelete,
}: RecoveryConfigurationProps) {
    const { t } = useTranslation();
    const formId = useId();
    const { onChainRecovery } = useConnectedWalletRecovery();
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
            {/* Status first: reassure the user recovery is on and healthy. */}
            <Card variant="muted" padding="default">
                <Stack space="m">
                    <Box
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        gap="s"
                    >
                        <IconCircle size="lg">
                            <ShieldIcon width={28} height={28} />
                        </IconCircle>
                        <Text variant="body" weight="medium">
                            {t("wallet.recoverySetup.config.activeTitle")}
                        </Text>
                        <Badge variant="success">
                            {t("wallet.recoverySetup.config.active")}
                        </Badge>
                    </Box>
                    {onChainRecovery && (
                        <Stack space="s">
                            <SummaryRow
                                label={t(
                                    "wallet.recoverySetup.config.startLabel"
                                )}
                                value={formatter.format(
                                    new Date(onChainRecovery.validAfter * 1000)
                                )}
                            />
                            <SummaryRow
                                label={t(
                                    "wallet.recoverySetup.config.endLabel"
                                )}
                                value={
                                    onChainRecovery.validUntil
                                        ? formatter.format(
                                              new Date(
                                                  onChainRecovery.validUntil *
                                                      1000
                                              )
                                          )
                                        : t("wallet.recoverySetup.config.never")
                                }
                            />
                        </Stack>
                    )}
                </Stack>
            </Card>

            {/* Frequent, safe self-check — collapsed so it doesn't dominate. */}
            <Card padding="default">
                <Accordion type="single" collapsible>
                    <AccordionItem
                        value="test-password"
                        className={styles.accordionItem}
                    >
                        <AccordionTrigger>
                            {t("wallet.recoverySetup.config.testTitle")}
                        </AccordionTrigger>
                        <AccordionContent>
                            <Stack space="s" className={styles.testContent}>
                                <Text variant="caption" color="tertiary">
                                    {t(
                                        "wallet.recoverySetup.config.testDescription"
                                    )}
                                </Text>
                                <form
                                    id={formId}
                                    className={formStyles.form}
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        handleTest();
                                    }}
                                >
                                    <PasswordInput
                                        toggleLabel={t(
                                            "wallet.recoverySetup.password.toggle"
                                        )}
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
                                        disabled={
                                            isPending || password.length === 0
                                        }
                                    >
                                        {t(
                                            "wallet.recoverySetup.config.testButton"
                                        )}
                                    </Button>
                                </form>
                                {result === "valid" && (
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            "wallet.recoverySetup.config.testValid"
                                        )}
                                    </Text>
                                )}
                                {result === "invalid" && (
                                    <Text variant="bodySmall" color="error">
                                        {t(
                                            "wallet.recoverySetup.config.testInvalid"
                                        )}
                                    </Text>
                                )}
                            </Stack>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </Card>

            {/* Rare reconfiguration actions, as a calm settings list. */}
            <Stack space="s">
                <Text variant="bodySmall" weight="medium">
                    {t("wallet.recoverySetup.config.refreshTitle")}
                </Text>
                <InfoCard>
                    <InfoRow
                        icon={CalendarIcon}
                        label={t(
                            "wallet.recoverySetup.config.updateDatesAction"
                        )}
                        onClick={onUpdateDates}
                        action={<ChevronRightIcon width={20} height={20} />}
                    />
                    <InfoRow
                        icon={RefreshIcon}
                        label={t(
                            "wallet.recoverySetup.config.replaceKeyAction"
                        )}
                        onClick={onReplaceKey}
                        action={<ChevronRightIcon width={20} height={20} />}
                    />
                </InfoCard>
            </Stack>

            {/* Irreversible: demoted to a quiet link, away from the rest. */}
            <Box className={styles.deleteWrapper}>
                <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    width="auto"
                    onClick={onDelete}
                >
                    <Text
                        as="span"
                        variant="bodySmall"
                        weight="medium"
                        color="error"
                    >
                        {t("wallet.recoverySetup.config.deleteAction")}
                    </Text>
                </Button>
            </Box>
        </FlowStepScreen>
    );
}
