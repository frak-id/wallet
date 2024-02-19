import { Fingerprint } from "@/assets/icons/Fingerprint";
import { FingerprintGrey } from "@/assets/icons/FingerprintGrey";
import { Panel } from "@/module/common/component/Panel";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    action?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
};

function ComponentAsSpan({ children }: PropsWithChildren) {
    return (
        <span className={`button ${styles.recover__button}`}>{children}</span>
    );
}

function ComponentAsButton({
    children,
    disabled,
    action,
}: PropsWithChildren<AuthFingerprintProps>) {
    return (
        <button
            type={"button"}
            className={`button ${styles.recover__button}`}
            disabled={disabled}
            onClick={action}
        >
            {children}
        </button>
    );
}

export function AuthFingerprint({
    children,
    action,
    disabled,
    icon,
}: PropsWithChildren<AuthFingerprintProps>) {
    const content = icon ? (
        icon
    ) : disabled ? (
        <FingerprintGrey />
    ) : (
        <Fingerprint />
    );
    const Component = action ? ComponentAsButton : ComponentAsSpan;
    return (
        <Panel size={"big"} withShadow={true}>
            <Component action={action} disabled={disabled}>
                {content}
                <span>{children}</span>
            </Component>
        </Panel>
    );
}
