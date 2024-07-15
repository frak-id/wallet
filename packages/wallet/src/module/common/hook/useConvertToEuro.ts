import { isConvertToEuroEnableAtom } from "@/module/settings/atoms/betaOptions";
import { computeWithPrecision } from "@module/utils/computeWithPrecision";
import { useAtomValue } from "jotai";
import { useCallback } from "react";

const EXCHANGE_RATE = 0.01;

export function useConvertToEuro() {
    const isEnabled = useAtomValue(isConvertToEuroEnableAtom);

    const convertToEuro = useCallback(
        (amount: string | number, token = "") => {
            if (!(isEnabled && amount)) return `${amount} ${token}`;
            return `${computeWithPrecision(Number(amount), EXCHANGE_RATE, "*")} €`;
        },
        [isEnabled]
    );

    return { convertToEuro, isEnabled };
}
