import { Fingerprint } from "@module/asset/icons/Fingerprint";
import { FingerprintGrey } from "@module/asset/icons/FingerprintGrey";
import { ButtonRipple } from "@module/component/ButtonRipple";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    action?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
    className?: string;
};

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
    return (
        <>
            <ButtonRipple
                onClick={action}
                disabled={disabled}
                size={"big"}
                className={`${className} ${styles["authFingerprint__button--centered"]} ${styles.authFingerprint__shiny}`}
            >
                {content}
                <span>{children}</span>
            </ButtonRipple>
        </>
    );
}
