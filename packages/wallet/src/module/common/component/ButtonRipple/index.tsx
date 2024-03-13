import { Loader } from "@/assets/icons/Loader";
import type React from "react";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    type?: "button" | "submit";
    onClick?: () => void;
    timeout?: number;
    disabled?: boolean;
    icon?: ReactNode;
    className?: string;
    size?: "none" | "small" | "normal" | "big";
    isLoading?: boolean;
};

function createRipple(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const button = event.currentTarget as HTMLButtonElement;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add(styles.buttonRipple__span);

    const ripple = button.getElementsByClassName(styles.buttonRipple__span)[0];

    if (ripple) {
        ripple.remove();
    }

    button.appendChild(circle);
}

export function ButtonRipple({
    children,
    type = "button",
    disabled,
    onClick,
    timeout = 0,
    className = "",
    size,
    isLoading,
}: PropsWithChildren<AuthFingerprintProps>) {
    const sizeClass = size ? styles[`size--${size}`] : styles["size--normal"];

    /*const buttonRef = React.useRef(null);
    // throw your mousemove callback up here to "add" and "remove" later
    // might be worth a useCallback based on the containerRef as well!
    function mouseMoveEvent(e) {
        if (!buttonRef.current) return;
        const { x, y } = buttonRef.current.getBoundingClientRect();
        buttonRef.current.style.setProperty("--x", e.clientX - x);
        buttonRef.current.style.setProperty("--y", e.clientY - y);
    }*/

    /*useEffect(() => {
        if (buttonRef.current) {
            buttonRef.current.addEventListener("mousemove", mouseMoveEvent);
        }
        // don't forget to *remove* the eventListener
        // when your component unmounts!
        return () => {
            if (buttonRef.current) {
                buttonRef.current.removeEventListener(
                    "mousemove",
                    mouseMoveEvent
                );
            }
        };
    }, []);*/

    return (
        <button
            // ref={buttonRef}
            type={type}
            className={`button ${styles.buttonRipple__shiny} ${
                styles.buttonRipple__button
            } ${sizeClass} ${className} ${isLoading ? styles.isLoading : ""}`}
            disabled={disabled}
            onClick={(event) => {
                createRipple(event);
                setTimeout(() => onClick?.(), timeout);
            }}
        >
            <>
                {isLoading && <Loader className={styles.loader} />}
                {children}
            </>
        </button>
    );
}
