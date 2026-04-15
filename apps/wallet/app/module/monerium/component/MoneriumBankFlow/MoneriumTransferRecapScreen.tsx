import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, TransferIcon } from "@frak-labs/design-system/icons";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMoneriumOfframp } from "@/module/monerium/hooks/useMoneriumOfframp";
import {
    ibanStore,
    selectEffectiveIban,
} from "@/module/monerium/store/ibanStore";
import {
    moneriumFlowStore,
    selectAmount,
    selectNote,
    selectSelectedIbanOverride,
} from "@/module/monerium/store/moneriumFlowStore";
import { maskIban } from "@/module/monerium/utils/maskIban";
import * as styles from "./index.css";
import { MoneriumScreen } from "./MoneriumScreen";
import { MoneriumTransferSuccessModal } from "./MoneriumTransferSuccessModal";

type MoneriumTransferRecapScreenProps = {
    onClose: () => void;
};

function normalizeAmountForApi(raw: string): string {
    return raw.replace(",", ".").trim();
}

/**
 * Step 2 of the offramp sub-flow — summary of the transfer (amount,
 * beneficiary, optional note).  Owns the mutation lifecycle via
 * `useMoneriumOfframp` and displays the success modal on completion.
 */
export function MoneriumTransferRecapScreen({
    onClose,
}: MoneriumTransferRecapScreenProps) {
    const { t } = useTranslation();

    const amount = moneriumFlowStore(selectAmount);
    const note = moneriumFlowStore(selectNote);
    const setNote = moneriumFlowStore((s) => s.setNote);
    const goTo = moneriumFlowStore((s) => s.goTo);
    const selectedOverride = moneriumFlowStore(selectSelectedIbanOverride);
    const effectiveIban = ibanStore(selectEffectiveIban);
    const selectedIban = selectedOverride ?? effectiveIban;

    const { placeOrder, isPending, isSuccess, isError, error, reset } =
        useMoneriumOfframp();

    const errorMessage = isError && error ? error.message : null;

    // Pre-fill the note with a localized default on first visit
    const defaultNote = t("monerium.bankFlow.transfer.recap.defaultNote");
    useEffect(() => {
        if (note.length === 0) {
            setNote(defaultNote);
        }
    }, [defaultNote, note.length, setNote]);

    const handleBackToAmount = useCallback(() => {
        reset();
        goTo("transfer-amount");
    }, [reset, goTo]);

    const handleConfirm = useCallback(async () => {
        if (!selectedIban) return;
        try {
            await placeOrder({
                amount: normalizeAmountForApi(amount),
                iban: selectedIban.iban,
                memo: note,
            });
        } catch {
            // Error is exposed via `isError` / `error`, no rethrow needed.
        }
    }, [amount, note, placeOrder, selectedIban]);

    const handleSuccessClose = useCallback(
        (open: boolean) => {
            if (open) return;
            reset();
            onClose();
        },
        [onClose, reset]
    );

    // Guard: if no IBAN is selected, go back to the amount screen
    if (!selectedIban) {
        goTo("transfer-amount");
        return null;
    }

    return (
        <>
            <MoneriumScreen
                onClose={handleBackToAmount}
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
                ctaOnClick={handleConfirm}
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
                                {t(
                                    "monerium.bankFlow.transfer.recap.amountLabel"
                                )}
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
                                    {selectedIban.name}
                                </Text>
                                <Text variant="bodySmall" color="secondary">
                                    {maskIban(selectedIban.iban)}
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
                            onChange={(e) => setNote(e.target.value)}
                            disabled={isPending}
                            rightSection={
                                note.length > 0 ? (
                                    <button
                                        type="button"
                                        className={styles.linkButton}
                                        onClick={() => setNote("")}
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
            <MoneriumTransferSuccessModal
                open={isSuccess}
                onOpenChange={handleSuccessClose}
                amount={amount}
            />
        </>
    );
}
