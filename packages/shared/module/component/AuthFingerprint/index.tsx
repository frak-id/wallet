import { Fingerprint } from "@shared/module/asset/icons/Fingerprint";
import { FingerprintFrak } from "@shared/module/asset/icons/FingerprintFrak";
import { ButtonRipple } from "@shared/module/component/ButtonRipple";
import { cx } from "class-variance-authority";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    action?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
    className?: string;
    isShiny?: boolean;
    childrenPosition?: "top" | "bottom";
};

export function AuthFingerprint({
    children,
    action,
    disabled,
    icon,
    className = "",
    isShiny = true,
    childrenPosition = "bottom",
}: PropsWithChildren<AuthFingerprintProps>) {
    const content = icon ? (
        icon
    ) : disabled ? (
        <Fingerprint />
    ) : (
        <FingerprintFrak />
    );
    return (
        <>
            {childrenPosition === "top" && <span>{children}</span>}
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
                {childrenPosition === "bottom" && <span>{children}</span>}
            </ButtonRipple>
        </>
    );
}
