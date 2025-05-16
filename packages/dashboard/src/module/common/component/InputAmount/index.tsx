import { preferredCurrencyAtom } from "@/module/common/atoms/currency";
import {
    InputNumber,
    type InputNumberProps,
} from "@shared/module/component/forms/InputNumber";
import { useAtomValue } from "jotai";

export function InputAmount({ ...props }: InputNumberProps) {
    const preferredCurrency = useAtomValue(preferredCurrencyAtom);

    return <InputNumber rightSection={preferredCurrency} {...props} />;
}

InputAmount.displayName = "InputAmount";
