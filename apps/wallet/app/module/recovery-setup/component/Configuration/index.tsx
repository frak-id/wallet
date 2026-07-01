import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    LockIcon,
    RefreshIcon,
    ShieldIcon,
} from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { useDateFormatter } from "@/module/common/hook/useDateFormatter";
import { SummaryRow } from "@/module/recovery-setup/component/SummaryRow";
import { useConnectedWalletRecovery } from "@/module/recovery-setup/hook/useConnectedWalletRecovery";

type RecoveryConfigurationProps = {
    onBack: () => void;
    /** Open the standalone password self-check screen. */
    onVerifyPassword: () => void;
    /** Keep the same burner, change only the on-chain validity dates. */
    onUpdateDates: () => void;
    /** Mint a fresh burner and replace the stored backup. */
    onReplaceKey: () => void;
    /** Disable recovery on-chain and delete the stored backup. */
    onDelete: () => void;
};

export function RecoveryConfiguration({
    onBack,
    onVerifyPassword,
    onUpdateDates,
    onReplaceKey,
    onDelete,
}: RecoveryConfigurationProps) {
    const { t } = useTranslation();
    const { onChainRecovery } = useConnectedWalletRecovery();
    const formatter = useDateFormatter();

    return (
        <FlowStepScreen
            title={t("wallet.recoverySetup.config.title")}
            description={t("wallet.recoverySetup.config.description")}
            onBack={onBack}
        >
            {/* Status hero: reassure the user recovery is on and healthy.
                Rendered directly on the page background (no card) so the
                blue icon disc stands out instead of muddying against grey. */}
            <Stack space="s" align="center">
                <IconCircle size="lg" tone="action">
                    <ShieldIcon width={28} height={28} />
                </IconCircle>
                <Text variant="body" weight="medium">
                    {t("wallet.recoverySetup.config.activeTitle")}
                </Text>
            </Stack>

            {/* On-chain validity window as a plain data card. */}
            {onChainRecovery && (
                <Card variant="muted" padding="default">
                    <Stack space="s">
                        <SummaryRow
                            label={t("wallet.recoverySetup.config.startLabel")}
                            value={formatter.format(
                                new Date(onChainRecovery.validAfter * 1000)
                            )}
                        />
                        <SummaryRow
                            label={t("wallet.recoverySetup.config.endLabel")}
                            value={
                                onChainRecovery.validUntil
                                    ? formatter.format(
                                          new Date(
                                              onChainRecovery.validUntil * 1000
                                          )
                                      )
                                    : t("wallet.recoverySetup.config.never")
                            }
                        />
                    </Stack>
                </Card>
            )}

            {/* All recovery actions as uniform, profile-style nav rows: a
                leading icon and label (no trailing chevron, matching the
                profile/referral rows). Each opens its own screen — no inline
                toggles. */}
            <InfoCard>
                <InfoRow
                    icon={LockIcon}
                    label={t("wallet.recoverySetup.config.testTitle")}
                    onClick={onVerifyPassword}
                />
                <InfoRow
                    icon={CalendarIcon}
                    label={t("wallet.recoverySetup.config.updateDatesAction")}
                    onClick={onUpdateDates}
                />
                <InfoRow
                    icon={RefreshIcon}
                    label={t("wallet.recoverySetup.config.replaceKeyAction")}
                    onClick={onReplaceKey}
                />
            </InfoCard>

            {/* Irreversible: demoted to a quiet, centered link. */}
            <Stack space="none" align="center">
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
            </Stack>
        </FlowStepScreen>
    );
}
