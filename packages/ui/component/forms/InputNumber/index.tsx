import type {
    ControllerRenderProps,
    FieldPath,
    FieldValues,
} from "react-hook-form";
import { Input, type InputProps } from "../Input";

export type InputNumberProps = InputProps &
    ControllerRenderProps<FieldValues, FieldPath<FieldValues>>;

export const InputNumber = ({ ref, onChange, ...props }: InputNumberProps) => {
    return (
        <Input
            {...props}
            ref={ref}
            type={"number"}
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
