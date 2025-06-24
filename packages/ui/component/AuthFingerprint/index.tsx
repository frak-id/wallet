import { cx } from "class-variance-authority";
import type { PropsWithChildren, ReactNode } from "react";
import { ButtonAuth } from "../ButtonAuth";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    action?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
    className?: string;
    isShiny?: boolean;
    childrenPosition?: "top" | "bottom";
    isLoading?: boolean;
};

export function AuthFingerprint({
    children,
    action,
    disabled,
    icon,
    className = "",
    isShiny = true,
    isLoading,
    childrenPosition = "bottom",
}: PropsWithChildren<AuthFingerprintProps>) {
    // const content = icon ? (
    //     icon
    // ) : disabled ? (
    //     <Fingerprint />
    // ) : (
    //     <FingerprintFrak />
    // );
    return (
        <>
            {childrenPosition === "top" && <span>{children}</span>}
            <ButtonAuth
                onClick={action}
                disabled={disabled}
                size={"big"}
                isLoading={isLoading}
                className={cx(
                    className,
                    styles["authFingerprint__button--centered"],
                    isShiny && styles.authFingerprint__shiny
                )}
            >
                {/* {content} */}
                {childrenPosition === "bottom" && <span>{children}</span>}
            </ButtonAuth>
        </>
    );
}
