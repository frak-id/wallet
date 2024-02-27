import type React from "react";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    onClick?: () => void;
    timeout?: number;
    disabled?: boolean;
    icon?: ReactNode;
    className?: string;
    size?: "none" | "small" | "normal" | "big";
};

function createRipple(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const button = event.currentTarget as HTMLButtonElement;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    const main = document.querySelector("main");
    const mainSizes = main?.getBoundingClientRect();
    if (!mainSizes) return;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${
        event.clientX - button.offsetLeft - mainSizes?.left - radius
    }px`;
    circle.style.top = `${
        event.clientY - button.offsetTop - mainSizes?.top - radius
    }px`;
    circle.classList.add(styles.buttonRipple__span);

    const ripple = button.getElementsByClassName(styles.buttonRipple__span)[0];

    if (ripple) {
        ripple.remove();
    }

    button.appendChild(circle);
}

export function ButtonRipple({
    children,
    disabled,
    onClick,
    timeout = 0,
    className = "",
    size,
}: PropsWithChildren<AuthFingerprintProps>) {
    const sizeClass = size ? styles[`size--${size}`] : styles["size--normal"];
    return (
        <button
            type={"button"}
            className={`button ${styles.buttonRipple__button} ${sizeClass} ${className}`}
            disabled={disabled}
            onClick={(event) => {
                createRipple(event);
                setTimeout(() => onClick?.(), timeout);
            }}
        >
            {children}
        </button>
    );
}
