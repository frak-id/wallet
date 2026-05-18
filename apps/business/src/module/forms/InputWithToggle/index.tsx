import { Pencil } from "lucide-react";
import { useState } from "react";
import { Row } from "@/module/common/component/Row";
import { Input, type InputProps } from "@/module/forms/Input";
import { inputWithToggleButton } from "./input-with-toggle.css";

export const InputWithToggle = ({ ref, disabled, ...props }: InputProps) => {
    const [isDisabled, setIsDisabled] = useState(true);
    return (
        <Row align={"center"}>
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
        </Row>
    );
};
InputWithToggle.displayName = "InputWithToggle";
