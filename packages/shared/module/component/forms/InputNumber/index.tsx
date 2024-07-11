import { Input } from "@module/component/forms/Input";
import type { InputProps } from "@module/component/forms/Input";
import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import type {
    ControllerRenderProps,
    FieldPath,
    FieldValues,
} from "react-hook-form";

interface InputNumberProps extends InputHTMLAttributes<HTMLInputElement> {}

export const InputNumber = forwardRef<
    HTMLInputElement,
    InputNumberProps &
        InputProps &
        ControllerRenderProps<FieldValues, FieldPath<FieldValues>>
>(({ onChange, ...props }, ref) => {
    return (
        <Input
            {...props}
            ref={ref}
            type={"number"}
            onChange={(event) => {
                onChange(event.target.valueAsNumber);
            }}
        />
    );
});
InputNumber.displayName = "InputNumber";
