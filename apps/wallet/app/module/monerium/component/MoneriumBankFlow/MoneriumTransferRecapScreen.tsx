import {
    getIbanCountry,
    isValidMemo,
    MONERIUM_DEFAULT_MEMO,
    MONERIUM_LIMITS,
    normalizeRedeemAmount,
} from "@frak-labs/app-essentials/monerium";
import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Text } from "@frak-labs/design-system/components/Text";
import { BankIcon, CloseIcon } from "@frak-labs/design-system/icons";
import { formatCurrency } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LabelledInput } from "@/module/common/component/LabelledInput";
import { useMoneriumOfframp } from "@/module/monerium/hooks/useMoneriumOfframp";
import {
    ibanStore,
    selectEffectiveIban,
} from "@/module/monerium/store/ibanStore";
import {
    moneriumFlowStore,
    selectAmount,
    selectNote,
} from "@/module/monerium/store/moneriumFlowStore";
import { maskIban } from "@/module/monerium/utils/maskIban";
import {
    getMoneriumErrorCode,
    getMoneriumErrorKey,
} from "@/module/monerium/utils/moneriumErrors";
import * as styles from "./index.css";
import { MoneriumScreen } from "./MoneriumScreen";
import { MoneriumTransferSuccessModal } from "./MoneriumTransferSuccessModal";

type MoneriumTransferRecapScreenProps = {
    onClose: () => void;
};

/**
 * Step 2 of the offramp sub-flow — summary of the transfer (amount,
 * beneficiary, optional note).  Owns the mutation lifecycle via
 * `useMoneriumOfframp` and displays the success modal on completion.
 */
export function MoneriumTransferRecapScreen({
    onClose,
}: MoneriumTransferRecapScreenProps) {
    const { t, i18n } = useTranslation();

    const amount = moneriumFlowStore(selectAmount);
    const amountValue = Number(normalizeRedeemAmount(amount));
    const formattedAmount = formatCurrency(amountValue, "EUR", i18n.language);
    const note = moneriumFlowStore(selectNote);
    const setNote = moneriumFlowStore((s) => s.setNote);
    const goTo = moneriumFlowStore((s) => s.goTo);
    const orderIdFor = moneriumFlowStore((s) => s.orderIdFor);
    const forgetOrderId = moneriumFlowStore((s) => s.forgetOrderId);
    const selectedIban = ibanStore(selectEffectiveIban);

    const { placeOrder, isPending, isSuccess, error, reset } =
        useMoneriumOfframp();

    const errorMessage = error ? t(getMoneriumErrorKey(error)) : null;

    const isMemoValid = note.trim() === "" || isValidMemo(note);

    useEffect(() => {
        if (!selectedIban) goTo("transfer-amount");
    }, [selectedIban, goTo]);

    const noteInputRef = useRef<HTMLInputElement>(null);
    const handleClearNote = useCallback(() => {
        setNote("");
        noteInputRef.current?.focus();
    }, [setNote]);

    const handleBackToAmount = useCallback(() => {
        reset();
        goTo("transfer-amount");
    }, [reset, goTo]);

    function handleConfirm() {
        if (!selectedIban || !isMemoValid) return;
        placeOrder(
            {
                orderId: orderIdFor(`${amountValue}:${selectedIban.iban}`),
                amount,
                iban: selectedIban.iban,
                counterpart: selectedIban.own
                    ? { own: true }
                    : {
                          own: false,
                          firstName: selectedIban.firstName,
                          lastName: selectedIban.lastName,
                          country:
                              selectedIban.country ??
                              getIbanCountry(selectedIban.iban) ??
                              "",
                      },
                memo: note,
            },
            {
                onSuccess: forgetOrderId,
                // A refused order keeps its id at Monerium: retrying it would only replay the refusal.
                onError: (failure) => {
                    if (
                        getMoneriumErrorCode(failure) ===
                        "MONERIUM_ORDER_REJECTED"
                    ) {
                        forgetOrderId();
                    }
                },
            }
        );
    }

    const handleSuccessClose = useCallback(
        (open: boolean) => {
            if (open) return;
            reset();
            onClose();
        },
        [onClose, reset]
    );

    if (!selectedIban) return null;

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
                ctaDisabled={isPending || !isMemoValid}
            >
                <Card variant="elevated" padding="none">
                    <Spread space="m" className={styles.recapRow}>
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
                            {formattedAmount}
                        </Text>
                    </Spread>
                    <Spread space="m" className={styles.recapRow}>
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
                                {t(
                                    "monerium.bankFlow.transfer.recap.beneficiaryIban",
                                    { iban: maskIban(selectedIban.iban) }
                                )}
                            </Text>
                        </Box>
                    </Spread>
                </Card>

                <LabelledInput
                    label={t("monerium.bankFlow.transfer.recap.addNote")}
                    ref={noteInputRef}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={isPending}
                    placeholder={MONERIUM_DEFAULT_MEMO}
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
                    errorMessage={
                        isMemoValid
                            ? undefined
                            : t(
                                  "monerium.bankFlow.transfer.recap.memoInvalid",
                                  {
                                      min: MONERIUM_LIMITS.MEMO_MIN_LENGTH,
                                      max: MONERIUM_LIMITS.MEMO_MAX_LENGTH,
                                  }
                              )
                    }
                />

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
                amount={formattedAmount}
            />
        </>
    );
}
