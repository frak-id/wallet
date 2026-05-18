import { Input } from "@frak-labs/design-system/components/Input";
import type { ComponentProps } from "react";
import type {
    ControllerRenderProps,
    FieldPath,
    FieldValues,
} from "react-hook-form";

type DSInputProps = ComponentProps<typeof Input>;

export type InputNumberProps = DSInputProps &
    ControllerRenderProps<FieldValues, FieldPath<FieldValues>>;

export const InputNumber = ({ ref, onChange, ...props }: InputNumberProps) => {
    return (
        <Input
            {...props}
            ref={ref}
            type="number"
            onChange={(event) => {
                if (Number.isNaN(event.target.valueAsNumber)) {
                    onChange("");
                    return;
                }
                onChange(event.target.valueAsNumber);
            }}
        />
    );
};
InputNumber.displayName = "InputNumber";
