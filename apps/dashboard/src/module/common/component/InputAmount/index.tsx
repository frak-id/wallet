import {
    InputNumber,
    type InputNumberProps,
} from "@frak-labs/ui/component/forms/InputNumber";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { preferredCurrencyAtom } from "@/module/common/atoms/currency";
import type { Campaign } from "@/types/Campaign";

export function InputAmount({ ...props }: InputNumberProps) {
    const preferredCurrency = useAtomValue(preferredCurrencyAtom);

    return <InputNumber rightSection={preferredCurrency} {...props} />;
}

export function InputAmountCampaign({ ...props }: InputNumberProps) {
    const { watch } = useFormContext<Campaign>();
    const setupCurrency = watch("setupCurrency");
    const preferredCurrency = useAtomValue(preferredCurrencyAtom);
    const currency = useMemo(
        () => setupCurrency ?? preferredCurrency,
        [setupCurrency, preferredCurrency]
    );

    return <InputNumber rightSection={currency} {...props} />;
}

InputAmount.displayName = "InputAmount";
