import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { TransferIcon, WalletIcon } from "@frak-labs/design-system/icons";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { IbanEntry } from "@/module/monerium/store/ibanStore";
import * as styles from "./index.css";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumTransferAmountScreenProps = {
    onClose: () => void;
    onContinue: () => void;
    onPickIban: () => void;
    amount: string;
    onAmountChange: (value: string) => void;
    selectedIban: IbanEntry | null;
};

function parseAmount(value: string): number {
    const normalized = value.replace(",", ".").trim();
    if (normalized.length === 0) return 0;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function maskIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length <= 8) return cleaned;
    return `${cleaned.slice(0, 4)} •••• •••• ${cleaned.slice(-4)}`;
}

/**
 * Step 1 of the offramp sub-flow — the user enters the amount to transfer
 * and can pick a beneficiary IBAN.
 */
export function MoneriumTransferAmountScreen({
    onClose,
    onContinue,
    onPickIban,
    amount,
    onAmountChange,
    selectedIban,
}: MoneriumTransferAmountScreenProps) {
    const { t } = useTranslation();
    const { userBalance } = useGetUserBalance();

    const eureBalance = useMemo(() => {
        if (!userBalance?.balances) return 0;
        const eureToken = userBalance.balances.find((b) => b.symbol === "EURe");
        return eureToken?.amount ?? 0;
    }, [userBalance]);

    const numericAmount = parseAmount(amount);
    const hasAmount = numericAmount > 0;
    const isInsufficient = hasAmount && numericAmount > eureBalance;
    const canContinue = hasAmount && !isInsufficient && selectedIban !== null;

    function handleAmountInput(event: React.ChangeEvent<HTMLInputElement>) {
        const raw = event.target.value;
        // Allow empty, digits, and a single separator (. or ,).
        if (raw === "" || /^\d+([.,]\d{0,2})?$/.test(raw)) {
            onAmountChange(raw);
        }
    }

    return (
        <MoneriumScreen
            onClose={onClose}
            ctaLabel={t("monerium.bankFlow.transfer.amount.continue")}
            ctaOnClick={onContinue}
            ctaDisabled={!canContinue}
        >
            <Stack space="l">
                <Text variant="heading2" align="center">
                    {t("monerium.bankFlow.transfer.amount.title")}
                </Text>

                {/* Wallet source card */}
                <Card
                    variant="elevated"
                    padding="default"
                    className={
                        isInsufficient ? styles.walletCardError : undefined
                    }
                >
                    <Inline space="m" alignY="center">
                        <Box className={styles.cardIconBubble}>
                            <WalletIcon width={20} height={20} />
                        </Box>
                        <Box flexGrow={1}>
                            <Text variant="label" color="secondary">
                                {t(
                                    "monerium.bankFlow.transfer.amount.walletLabel"
                                )}
                            </Text>
                            <Text
                                variant="body"
                                weight="semiBold"
                                color={isInsufficient ? "error" : "primary"}
                            >
                                {isInsufficient
                                    ? t(
                                          "monerium.bankFlow.transfer.amount.insufficientBalance"
                                      )
                                    : `${t("monerium.bankFlow.transfer.amount.totalBalance")} ${eureBalance} €`}
                            </Text>
                        </Box>
                    </Inline>
                </Card>

                {/* Beneficiary IBAN card */}
                <Card variant="elevated" padding="default">
                    <Inline space="m" alignY="center">
                        <Box className={styles.cardIconBubble}>
                            <TransferIcon width={20} height={20} />
                        </Box>
                        <Box flexGrow={1}>
                            <Text variant="label" color="secondary">
                                {t(
                                    "monerium.bankFlow.transfer.amount.ibanLabel"
                                )}
                            </Text>
                            <Text variant="body" weight="semiBold">
                                {selectedIban
                                    ? selectedIban.name ||
                                      maskIban(selectedIban.iban)
                                    : t(
                                          "monerium.bankFlow.transfer.amount.ibanEmpty"
                                      )}
                            </Text>
                        </Box>
                        <button
                            type="button"
                            className={styles.linkButton}
                            onClick={onPickIban}
                        >
                            <Text variant="bodySmall" color="action">
                                {t("monerium.bankFlow.transfer.amount.modify")}
                            </Text>
                        </button>
                    </Inline>
                </Card>

                {/* Amount input — large, centered, native numeric keypad */}
                <Box
                    display="flex"
                    alignItems="baseline"
                    justifyContent="center"
                    gap="xs"
                    paddingY="xl"
                >
                    <Box
                        as="input"
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={amount}
                        onChange={handleAmountInput}
                        className={styles.amountInput}
                        aria-label={t(
                            "monerium.bankFlow.transfer.amount.title"
                        )}
                    />
                    <Text variant="heading2" color="primary">
                        €
                    </Text>
                </Box>
            </Stack>
        </MoneriumScreen>
    );
}
