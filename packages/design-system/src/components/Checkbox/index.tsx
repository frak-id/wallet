import { Indicator, Root } from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { checkboxIndicator, checkboxRoot } from "./checkbox.css";

type CheckboxProps = ComponentPropsWithRef<typeof Root> & {
    className?: string;
};

export function Checkbox({ ref, className, ...props }: CheckboxProps) {
    const combinedClassName = [checkboxRoot, className]
        .filter(Boolean)
        .join(" ");

    return (
        <Root className={combinedClassName} ref={ref} {...props}>
            <Indicator className={checkboxIndicator}>
                {props.checked === "indeterminate" ? (
                    <Minus size={12} />
                ) : (
                    <Check size={14} />
                )}
            </Indicator>
        </Root>
    );
}
