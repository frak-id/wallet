import { Loader } from "@/assets/icons/Loader";
import backgroundImage from "@/assets/images/background-auth-fingerprint.svg";
import { preloadImage } from "@/module/common/utils/preloadImage";
import type React from "react";
import { useEffect, useState } from "react";
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
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    /**
     * Check if the image is loaded
     */
    useEffect(() => {
        preloadImage(backgroundImage.src).then(setIsImageLoaded);
    }, []);

    return (
        isImageLoaded && (
            <button
                type={type}
                style={{
                    backgroundImage: `url(${backgroundImage.src})`,
                }}
                className={`button ${
                    styles.buttonRipple__button
                } ${sizeClass} ${className} ${
                    isLoading ? styles.isLoading : ""
                }`}
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
        )
    );
}
