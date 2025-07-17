import { Panel } from "@/module/common/component/Panel";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import type { Hex } from "viem";
import styles from "./index.module.css";

interface RegistrationPanelProps {
    step: number;
    isPending: boolean;
    error?: Error;
    infoTxt?: string;
    mintTxHash?: Hex;
    onSubmit: () => void;
}

export function RegistrationPanel({
    step,
    isPending,
    error,
    infoTxt,
    mintTxHash,
    onSubmit,
}: RegistrationPanelProps) {
    return (
        <Panel
            title="Product Registration"
            className={`${styles.panel} ${step < 2 ? styles.panelDisabled : ""} ${
                step > 2 ? styles.panelLocked : ""
            }`}
        >
            {step < 2 ? (
                <div className={styles.disabledContent}>
                    <p>Complete validation in the previous step to continue</p>
                </div>
            ) : step === 2 ? (
                <div className={styles.registrationSection}>
                    <ButtonAuth onClick={onSubmit} disabled={isPending}>
                        Validate your product
                    </ButtonAuth>

                    {error && <p className="error">{error.message}</p>}

                    {infoTxt && (
                        <p>
                            {infoTxt}
                            <span className="dotsLoading">...</span>
                        </p>
                    )}
                </div>
            ) : (
                <div className={styles.successSection}>
                    <p className="success">
                        Your product has been successfully listed!
                    </p>
                    {mintTxHash && <p>Transaction hash: {mintTxHash}</p>}
                </div>
            )}
        </Panel>
    );
}
