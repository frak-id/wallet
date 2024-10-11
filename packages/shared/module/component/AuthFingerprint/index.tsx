import { Fingerprint } from "@module/asset/icons/Fingerprint";
import { FingerprintFrak } from "@module/asset/icons/FingerprintFrak";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { cx } from "class-variance-authority";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    action?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
    className?: string;
    isShiny?: boolean;
};

export function AuthFingerprint({
    children,
    action,
    disabled,
    icon,
    className = "",
    isShiny = true,
}: PropsWithChildren<AuthFingerprintProps>) {
    const content = icon ? (
        icon
    ) : disabled ? (
        <Fingerprint />
    ) : (
        <FingerprintFrak />
    );
    return (
        <ButtonRipple
            onClick={action}
            disabled={disabled}
            size={"big"}
            className={cx(
                className,
                styles["authFingerprint__button--centered"],
                isShiny && styles.authFingerprint__shiny
            )}
        >
            {content}
            <span>{children}</span>
        </ButtonRipple>
    );
}
