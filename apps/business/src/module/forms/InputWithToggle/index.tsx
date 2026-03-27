import { Input, type InputProps } from "@frak-labs/ui/component/forms/Input";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Row } from "@/module/common/component/Row";
import styles from "./index.module.css";

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
                className={styles.inputWithToggle__button}
                onClick={() => setIsDisabled(!isDisabled)}
                disabled={disabled}
            >
                <Pencil size={20} />
            </button>
        </Row>
    );
};
InputWithToggle.displayName = "InputWithToggle";
