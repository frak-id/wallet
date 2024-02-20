import { Fingerprint } from "@/assets/icons/Fingerprint";
import { FingerprintGrey } from "@/assets/icons/FingerprintGrey";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import type React from "react";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    action?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
    className?: string;
};

function ComponentAsSpan({
    className = "",
    children,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <span
            className={`button ${styles.authFingerprint__button} ${className}`}
        >
            {children}
        </span>
    );
}

export function AuthFingerprint({
    children,
    action,
    disabled,
    icon,
    className = "",
}: PropsWithChildren<AuthFingerprintProps>) {
    const content = icon ? (
        icon
    ) : disabled ? (
        <FingerprintGrey />
    ) : (
        <Fingerprint />
    );
    const Component = action ? ButtonRipple : ComponentAsSpan;
    return (
        <>
            <Component
                onClick={action}
                disabled={disabled}
                size={"big"}
                className={`${className} ${styles["authFingerprint__button--centered"]}`}
            >
                {content}
                <span>{children}</span>
            </Component>
        </>
    );
}
