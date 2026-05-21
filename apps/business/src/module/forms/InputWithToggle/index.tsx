import { Inline } from "@frak-labs/design-system/components/Inline";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Input, type InputProps } from "@/module/forms/Input";
import { inputWithToggleButton } from "./input-with-toggle.css";

export const InputWithToggle = ({ ref, disabled, ...props }: InputProps) => {
    const [isDisabled, setIsDisabled] = useState(true);
    return (
        <Inline space="m" alignY="center">
            <Input
                {...props}
                ref={ref}
                disabled={isDisabled}
                onBlur={() => setIsDisabled(true)}
            />
            <button
                type={"button"}
                className={inputWithToggleButton}
                onClick={() => setIsDisabled(!isDisabled)}
                disabled={disabled}
            >
                <Pencil size={20} />
            </button>
        </Inline>
    );
};
InputWithToggle.displayName = "InputWithToggle";
