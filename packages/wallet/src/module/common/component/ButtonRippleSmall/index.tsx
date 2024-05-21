import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type ButtonRippleSmallProps = {
    type?: "button" | "submit";
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    isLoading?: boolean;
};

export function ButtonRippleSmall({
    children,
    type = "button",
    disabled,
    onClick,
    className = "",
    isLoading,
}: PropsWithChildren<ButtonRippleSmallProps>) {
    return (
        <ButtonRipple
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={`${styles.buttonRippleSmall} ${className}`}
            isLoading={isLoading}
            size={"small"}
        >
            {children}
        </ButtonRipple>
    );
}
