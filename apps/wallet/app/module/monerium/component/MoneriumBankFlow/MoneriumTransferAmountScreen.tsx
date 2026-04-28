import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowDownIcon } from "@frak-labs/design-system/icons";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    ibanStore,
    selectEffectiveIban,
} from "@/module/monerium/store/ibanStore";
import {
    moneriumFlowStore,
    selectAmount,
    selectSelectedIbanOverride,
} from "@/module/monerium/store/moneriumFlowStore";
import { maskIban } from "@/module/monerium/utils/maskIban";
import * as styles from "./index.css";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumTransferAmountScreenProps = {
    onClose: () => void;
};

function parseAmount(value: string): number {
    const normalized = value.replace(",", ".").trim();
    if (normalized.length === 0) return 0;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function SwitcherIcon() {
    return (
        <Box className={styles.switcherDisc}>
            <ArrowDownIcon width={20} height={20} />
        </Box>
    );
}

/**
 * Step 1 of the offramp sub-flow — the user enters the amount to transfer
 * and can pick a beneficiary IBAN.
 */
export function MoneriumTransferAmountScreen({
    onClose,
}: MoneriumTransferAmountScreenProps) {
    const { t } = useTranslation();
    const { userBalance } = useGetUserBalance();

    const amount = moneriumFlowStore(selectAmount);
    const setAmount = moneriumFlowStore((s) => s.setAmount);
    const goTo = moneriumFlowStore((s) => s.goTo);
    const selectedOverride = moneriumFlowStore(selectSelectedIbanOverride);
    const effectiveIban = ibanStore(selectEffectiveIban);
    const selectedIban = selectedOverride ?? effectiveIban;

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
            setAmount(raw);
        }
    }

    return (
        <MoneriumScreen
            onClose={onClose}
            leftIcon="back"
            title={t("monerium.bankFlow.transfer.amount.title")}
            ctaLabel={t("monerium.bankFlow.transfer.amount.continue")}
            ctaOnClick={() => goTo("transfer-recap")}
            ctaDisabled={!canContinue}
        >
            <Box className={styles.cardsStack}>
                <Card
                    variant="elevated"
                    padding="none"
                    className={`${styles.transferCellPadding}${
                        isInsufficient ? ` ${styles.walletCardError}` : ""
                    }`}
                >
                    <Stack space="xxs">
                        <Text variant="body" weight="medium">
                            {t("monerium.bankFlow.transfer.amount.walletLabel")}
                        </Text>
                        <Text
                            variant="bodySmall"
                            color={isInsufficient ? "error" : "secondary"}
                        >
                            {`${t("monerium.bankFlow.transfer.amount.totalBalance")} : ${eureBalance}€`}
                        </Text>
                    </Stack>
                </Card>

                <Box className={styles.switcherIcon}>
                    <SwitcherIcon />
                </Box>

                <Card
                    variant="elevated"
                    padding="none"
                    className={styles.transferCellPadding}
                >
                    <Inline
                        space="m"
                        alignY="center"
                        align="space-between"
                        wrap={false}
                    >
                        <Stack space="xxs">
                            <Text variant="body" weight="medium">
                                {t(
                                    "monerium.bankFlow.transfer.amount.ibanLabel"
                                )}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {selectedIban
                                    ? selectedIban.name ||
                                      maskIban(selectedIban.iban)
                                    : t(
                                          "monerium.bankFlow.transfer.amount.ibanEmpty"
                                      )}
                            </Text>
                        </Stack>
                        <Button
                            variant="secondary"
                            size="small"
                            width="auto"
                            onClick={() => goTo("transfer-iban")}
                        >
                            {t("monerium.bankFlow.transfer.amount.modify")}
                        </Button>
                    </Inline>
                </Card>
            </Box>

            <Stack space="xs" align="center" className={styles.amountSection}>
                <Inline space="xs" alignY="center" wrap={false}>
                    <Box
                        as="input"
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={amount}
                        onChange={handleAmountInput}
                        className={styles.amountInput}
                        // `ch`-based width tracks the typed value's length
                        // — works everywhere, no `field-sizing` dependency.
                        style={{
                            width: `${Math.max((amount || "0").length, 1)}ch`,
                        }}
                        aria-label={t(
                            "monerium.bankFlow.transfer.amount.title"
                        )}
                    />
                    <Text variant="display" weight="bold" color="primary">
                        €
                    </Text>
                </Inline>
                {isInsufficient ? (
                    <Text variant="caption" color="error">
                        {t(
                            "monerium.bankFlow.transfer.amount.insufficientBalance"
                        )}
                    </Text>
                ) : null}
            </Stack>
        </MoneriumScreen>
    );
}
