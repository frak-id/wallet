import {
    InputNumber,
    type InputNumberProps,
} from "@frak-labs/ui/component/forms/InputNumber";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { currencyStore } from "@/stores/currencyStore";
import type { Campaign } from "@/types/Campaign";

export function InputAmount({ ...props }: InputNumberProps) {
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);

    return <InputNumber rightSection={preferredCurrency} {...props} />;
}

export function InputAmountCampaign({ ...props }: InputNumberProps) {
    const { watch } = useFormContext<Campaign>();
    const setupCurrency = watch("setupCurrency");
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const currency = useMemo(
        () => setupCurrency ?? preferredCurrency,
        [setupCurrency, preferredCurrency]
    );

    return <InputNumber rightSection={currency} {...props} />;
}

InputAmount.displayName = "InputAmount";
