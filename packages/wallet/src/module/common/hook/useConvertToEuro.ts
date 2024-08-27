import { isConvertToEuroEnableAtom } from "@/module/settings/atoms/betaOptions";
import { computeWithPrecision } from "@module/utils/computeWithPrecision";
import { useAtomValue } from "jotai";
import { useCallback } from "react";

const USD_TO_EUR_EXCHANGE_RATE = 0.9;

export function useConvertToEuro() {
    const isEnabled = useAtomValue(isConvertToEuroEnableAtom);

    const convertToEuro = useCallback(
        (amount: string | number, token = "") => {
            if (!(isEnabled && amount)) return `${amount} ${token}`;
            return `${computeWithPrecision(Number(amount), USD_TO_EUR_EXCHANGE_RATE, "*")} €`;
        },
        [isEnabled]
    );

    return { convertToEuro, isEnabled };
}
