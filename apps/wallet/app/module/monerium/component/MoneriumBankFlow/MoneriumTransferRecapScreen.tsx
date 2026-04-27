import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { Text } from "@frak-labs/design-system/components/Text";
import { BankIcon, CloseIcon } from "@frak-labs/design-system/icons";
import { useCallback, useEffect, useRef } from "react";
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

    // Pre-fill once on mount. Reads `note` via `getState()` so the effect
    // doesn't re-seed when the user clears the field through the × button.
    // `defaultNote` deliberately omitted from deps — language switches mid-flow
    // shouldn't overwrite a user-typed note.
    const defaultNote = t("monerium.bankFlow.transfer.recap.defaultNote");
    useEffect(() => {
        if (moneriumFlowStore.getState().note.length === 0) {
            setNote(defaultNote);
        }
    }, [setNote]);

    const noteInputRef = useRef<HTMLInputElement>(null);
    const handleClearNote = useCallback(() => {
        setNote("");
        noteInputRef.current?.focus();
    }, [setNote]);

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
            // surfaced via `isError` / `error`
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

    if (!selectedIban) {
        goTo("transfer-amount");
        return null;
    }

    return (
        <>
            <MoneriumScreen
                onClose={handleBackToAmount}
                leftIcon="back"
                title={t("monerium.bankFlow.transfer.recap.title")}
                topRight={
                    <button
                        type="button"
                        className={styles.linkButton}
                        onClick={onClose}
                    >
                        <Text
                            variant="bodySmall"
                            color="action"
                            weight="semiBold"
                        >
                            {t("monerium.bankFlow.transfer.recap.cancel")}
                        </Text>
                    </button>
                }
                ctaLabel={t("monerium.bankFlow.transfer.recap.confirm")}
                ctaOnClick={handleConfirm}
                ctaLoading={isPending}
                ctaDisabled={isPending}
            >
                <Card variant="elevated" padding="none">
                    <Box className={styles.recapRow}>
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t("monerium.bankFlow.transfer.recap.amountLabel")}
                        </Text>
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="primary"
                        >
                            {amount} €
                        </Text>
                    </Box>
                    <Box className={styles.recapRow}>
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t(
                                "monerium.bankFlow.transfer.recap.beneficiaryLabel"
                            )}
                        </Text>
                        <Box display={"flex"} alignItems={"center"} gap={"xxs"}>
                            <Box
                                color={"primary"}
                                display={"flex"}
                                alignItems={"center"}
                            >
                                <BankIcon width={16} height={16} />
                            </Box>
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="primary"
                            >
                                IBAN {maskIban(selectedIban.iban)}
                            </Text>
                        </Box>
                    </Box>
                </Card>

                <Box display={"flex"} flexDirection={"column"} gap={"xs"}>
                    <Box paddingX={"m"}>
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t("monerium.bankFlow.transfer.recap.addNote")}
                        </Text>
                    </Box>
                    <Input
                        variant="bare"
                        length="big"
                        ref={noteInputRef}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={isPending}
                        aria-label={t(
                            "monerium.bankFlow.transfer.recap.addNote"
                        )}
                        rightSection={
                            note.length > 0 ? (
                                <button
                                    type="button"
                                    className={styles.noteClearButton}
                                    onClick={handleClearNote}
                                    aria-label={t("common.close")}
                                >
                                    <CloseIcon width={24} height={24} />
                                </button>
                            ) : null
                        }
                    />
                </Box>

                {/* Pushes the warning to the bottom of the body. */}
                <Box flexGrow={1} />

                <Text variant="caption" color="secondary" align="center">
                    {t("monerium.bankFlow.transfer.recap.warning")}
                </Text>

                {errorMessage ? (
                    <Text variant="bodySmall" color="error" align="center">
                        {errorMessage}
                    </Text>
                ) : null}
            </MoneriumScreen>
            <MoneriumTransferSuccessModal
                open={isSuccess}
                onOpenChange={handleSuccessClose}
                amount={amount}
            />
        </>
    );
}
