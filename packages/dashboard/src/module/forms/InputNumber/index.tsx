import { Input } from "@/module/forms/Input";
import type { InputProps } from "@/module/forms/Input";
import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";
import type {
    ControllerRenderProps,
    FieldPath,
    FieldValues,
} from "react-hook-form";

interface InputNumberProps extends InputHTMLAttributes<HTMLInputElement> {
    classNameWrapper?: string;
    leftSection?: string | ReactNode;
    rightSection?: string | ReactNode;
}

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
