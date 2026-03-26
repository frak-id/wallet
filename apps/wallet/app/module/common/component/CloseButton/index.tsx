import { CloseIcon } from "@frak-labs/design-system/icons";
import type { ButtonHTMLAttributes } from "react";
import * as styles from "./index.css";

type CloseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    ariaLabel: string;
    iconSize?: number;
    variant?: keyof typeof styles.closeButton;
};

export function CloseButton({
    ariaLabel,
    iconSize = 16,
    variant = "floating",
    className,
    ...props
}: CloseButtonProps) {
    const classes = [className, styles.closeButton[variant]]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type="button"
            aria-label={ariaLabel}
            className={classes}
            {...props}
        >
            <CloseIcon width={iconSize} height={iconSize} />
        </button>
    );
}
