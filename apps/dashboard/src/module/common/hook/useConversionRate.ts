import { backendApi } from "@frak-labs/client/server";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { type Address, formatUnits } from "viem";
import { preferredCurrencyAtom } from "../atoms/currency";
import { formatPrice } from "../utils/formatPrice";

function conversionRateQueryOptions(token?: Address) {
    return {
        enabled: !!token,
        queryKey: ["conversionRate", token],
        queryFn: async () => {
            if (!token) return null;

            const { data, error } = await backendApi.common.rate.get({
                query: { token },
            });
            if (error) {
                console.warn("Unable to get conversion rate", { error, token });
                return null;
            }
            return data;
        },
    };
}

function useConversionRate({ token }: { token?: Address }) {
    return useQuery(conversionRateQueryOptions(token));
}

/**
 * Convert a amount of tokens to the user preferred currency
 */
export function useConvertToPreferredCurrency({
    token,
    balance,
    decimals,
    amount,
}: {
    token?: Address;
    // For raw blockchain balance
    balance?: bigint;
    decimals?: number;
    // For simple decimal conversion
    amount?: number;
}) {
    const preferredCurrency = useAtomValue(preferredCurrencyAtom);
    const { data: rate } = useConversionRate({ token });

    return useMemo(() => {
        if (!rate) return undefined;

        // Get the decimal amount to convert
        let decimalAmount = amount;
        if (!amount && balance && decimals) {
            decimalAmount = Number.parseFloat(
                formatUnits(BigInt(balance), decimals)
            );
        }
        if (decimalAmount === undefined) return undefined;

        const rateValue = rate[preferredCurrency];
        if (!rateValue) return undefined;

        // Return the price formatted
        return formatPrice(
            decimalAmount * rateValue,
            undefined,
            preferredCurrency
        );
    }, [rate, preferredCurrency, balance, decimals, amount]);
}
