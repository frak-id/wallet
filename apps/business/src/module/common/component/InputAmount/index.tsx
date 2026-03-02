import {
    InputNumber,
    type InputNumberProps,
} from "@frak-labs/ui/component/forms/InputNumber";
import { currencyStore } from "@/stores/currencyStore";

export function InputAmount({ ...props }: InputNumberProps) {
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);

    return <InputNumber rightSection={preferredCurrency} {...props} />;
}

export function InputAmountCampaign({ ...props }: InputNumberProps) {
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);

    return <InputNumber rightSection={preferredCurrency} {...props} />;
}

InputAmount.displayName = "InputAmount";
