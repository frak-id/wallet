import { Fingerprint } from "@/assets/icons/Fingerprint";
import { FingerprintGrey } from "@/assets/icons/FingerprintGrey";
import { Panel } from "@/module/common/component/Panel";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type AuthFingerprintProps = {
    action: () => void;
    disabled?: boolean;
};

export function AuthFingerprint({
    children,
    action,
    disabled,
}: PropsWithChildren<AuthFingerprintProps>) {
    return (
        <Panel size={"big"} withShadow={true}>
            <button
                type={"button"}
                className={`button ${styles.recover__button}`}
                disabled={disabled}
                onClick={action}
            >
                {disabled ? <FingerprintGrey /> : <Fingerprint />}
                <span>{children}</span>
            </button>
        </Panel>
    );
}
