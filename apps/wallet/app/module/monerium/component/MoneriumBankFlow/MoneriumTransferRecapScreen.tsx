import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, TransferIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import type { IbanEntry } from "@/module/monerium/store/ibanStore";
import * as styles from "./index.css";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumTransferRecapScreenProps = {
    onBack: () => void;
    onClose: () => void;
    onConfirm: () => void;
    amount: string;
    note: string;
    onNoteChange: (value: string) => void;
    beneficiary: IbanEntry;
    isPending: boolean;
    errorMessage: string | null;
};

function maskIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length <= 8) return cleaned;
    return `${cleaned.slice(0, 4)} •••• •••• ${cleaned.slice(-4)}`;
}

/**
 * Step 2 of the offramp sub-flow — summary of the transfer (amount, beneficiary,
 * optional note). On confirm, triggers the Monerium offramp order.
 */
export function MoneriumTransferRecapScreen({
    onBack,
    onClose,
    onConfirm,
    amount,
    note,
    onNoteChange,
    beneficiary,
    isPending,
    errorMessage,
}: MoneriumTransferRecapScreenProps) {
    const { t } = useTranslation();

    return (
        <MoneriumScreen
            onClose={onBack}
            leftIcon="back"
            topRight={
                <button
                    type="button"
                    className={styles.linkButton}
                    onClick={onClose}
                >
                    <Text variant="bodySmall" color="action">
                        {t("monerium.bankFlow.transfer.recap.cancel")}
                    </Text>
                </button>
            }
            ctaLabel={t("monerium.bankFlow.transfer.recap.confirm")}
            ctaOnClick={onConfirm}
            ctaLoading={isPending}
            ctaDisabled={isPending}
        >
            <Stack space="l">
                <Text variant="heading2" align="center">
                    {t("monerium.bankFlow.transfer.recap.title")}
                </Text>

                {/* Amount row */}
                <Card variant="elevated" padding="default">
                    <Stack space="xs">
                        <Text variant="label" color="secondary">
                            {t("monerium.bankFlow.transfer.recap.amountLabel")}
                        </Text>
                        <Text variant="heading3">{amount} €</Text>
                    </Stack>
                </Card>

                {/* Beneficiary row */}
                <Card variant="elevated" padding="default">
                    <Inline space="m" alignY="center">
                        <Box className={styles.cardIconBubble}>
                            <TransferIcon width={20} height={20} />
                        </Box>
                        <Box flexGrow={1}>
                            <Text variant="label" color="secondary">
                                {t(
                                    "monerium.bankFlow.transfer.recap.beneficiaryLabel"
                                )}
                            </Text>
                            <Text variant="body" weight="semiBold">
                                {beneficiary.name}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {maskIban(beneficiary.iban)}
                            </Text>
                        </Box>
                    </Inline>
                </Card>

                {/* Note input */}
                <Stack space="xs">
                    <Text variant="label" color="secondary">
                        {t("monerium.bankFlow.transfer.recap.addNote")}
                    </Text>
                    <Input
                        length="big"
                        value={note}
                        onChange={(e) => onNoteChange(e.target.value)}
                        disabled={isPending}
                        rightSection={
                            note.length > 0 ? (
                                <button
                                    type="button"
                                    className={styles.linkButton}
                                    onClick={() => onNoteChange("")}
                                    aria-label={t("common.close")}
                                >
                                    <Box
                                        color="tertiary"
                                        display="flex"
                                        alignItems="center"
                                    >
                                        <CloseIcon width={14} height={14} />
                                    </Box>
                                </button>
                            ) : null
                        }
                    />
                </Stack>

                {/* Warning */}
                <Text variant="caption" color="secondary" align="center">
                    {t("monerium.bankFlow.transfer.recap.warning")}
                </Text>

                {errorMessage ? (
                    <Text variant="bodySmall" color="error" align="center">
                        {errorMessage}
                    </Text>
                ) : null}
            </Stack>
        </MoneriumScreen>
    );
}
