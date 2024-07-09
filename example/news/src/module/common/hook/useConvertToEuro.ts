import { useCallback } from "react";
import useLocalStorageState from "use-local-storage-state";

const EXCHANGE_RATE = 0.01;

export function useConvertToEuro() {
    const [isEnabled] = useLocalStorageState("amount-in-euro", {
        defaultValue: true,
    });

    const convertToEuro = useCallback(
        (amount: string | number, token = "") => {
            if (!(isEnabled && amount)) return `${amount} ${token}`;
            return `${Number(amount) * EXCHANGE_RATE} €`;
        },
        [isEnabled]
    );

    return { convertToEuro, isEnabled };
}
