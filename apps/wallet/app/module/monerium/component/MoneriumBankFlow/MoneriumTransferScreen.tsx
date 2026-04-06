import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMoneriumOfframp } from "@/module/monerium/hooks/useMoneriumOfframp";
import {
    type IbanEntry,
    ibanStore,
    selectEffectiveIban,
} from "@/module/monerium/store/ibanStore";
import { MoneriumTransferAmountScreen } from "./MoneriumTransferAmountScreen";
import { MoneriumTransferIbanScreen } from "./MoneriumTransferIbanScreen";
import { MoneriumTransferRecapScreen } from "./MoneriumTransferRecapScreen";
import { MoneriumTransferSuccessModal } from "./MoneriumTransferSuccessModal";

type MoneriumTransferScreenProps = {
    onClose: () => void;
};

type SubStep = "amount" | "recap" | "iban";

function normalizeAmountForApi(raw: string): string {
    return raw.replace(",", ".").trim();
}

/**
 * Sub-flow router for the Monerium offramp transfer. Manages local state
 * for the amount / note / selected IBAN as the user moves between the
 * amount entry, summary, and IBAN manager screens.
 */
export function MoneriumTransferScreen({
    onClose,
}: MoneriumTransferScreenProps) {
    const { t } = useTranslation();

    const defaultNote = t("monerium.bankFlow.transfer.recap.defaultNote");

    const [subStep, setSubStep] = useState<SubStep>("amount");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState(defaultNote);
    const [selectedOverride, setSelectedOverride] = useState<IbanEntry | null>(
        null
    );

    const effectiveIban = ibanStore(selectEffectiveIban);
    const selectedIban = selectedOverride ?? effectiveIban;

    const { placeOrder, isPending, isSuccess, isError, error, reset } =
        useMoneriumOfframp();

    const errorMessage = isError && error ? error.message : null;

    const handleContinue = useCallback(() => {
        setSubStep("recap");
    }, []);

    const handleBackToAmount = useCallback(() => {
        setSubStep("amount");
        reset();
    }, [reset]);

    const handlePickIban = useCallback(() => {
        setSubStep("iban");
    }, []);

    const handleSelectIban = useCallback((entry: IbanEntry) => {
        setSelectedOverride(entry);
        setSubStep("amount");
    }, []);

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

    // Reset the note to the localized default when the user enters the recap
    // for the first time (and when the locale changes mid-flow).
    useEffect(() => {
        if (subStep === "recap" && note.length === 0) {
            setNote(defaultNote);
        }
    }, [defaultNote, note.length, subStep]);

    if (subStep === "iban") {
        return (
            <MoneriumTransferIbanScreen
                onBack={() => setSubStep("amount")}
                onSelect={handleSelectIban}
                currentIban={selectedIban?.iban ?? null}
            />
        );
    }

    if (subStep === "recap" && selectedIban) {
        return (
            <>
                <MoneriumTransferRecapScreen
                    onBack={handleBackToAmount}
                    onClose={onClose}
                    onConfirm={handleConfirm}
                    amount={amount}
                    note={note}
                    onNoteChange={setNote}
                    beneficiary={selectedIban}
                    isPending={isPending}
                    errorMessage={errorMessage}
                />
                <MoneriumTransferSuccessModal
                    open={isSuccess}
                    onOpenChange={handleSuccessClose}
                    amount={amount}
                />
            </>
        );
    }

    return (
        <MoneriumTransferAmountScreen
            onClose={onClose}
            onContinue={handleContinue}
            onPickIban={handlePickIban}
            amount={amount}
            onAmountChange={setAmount}
            selectedIban={selectedIban}
        />
    );
}
