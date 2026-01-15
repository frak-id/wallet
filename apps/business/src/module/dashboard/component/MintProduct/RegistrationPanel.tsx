import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import styles from "./index.module.css";

interface RegistrationPanelProps {
    step: number;
    isPending: boolean;
    error?: Error | null;
    infoTxt?: string;
    merchantId?: string;
    onSubmit: () => void;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function RegistrationPanel({
    step,
    isPending,
    error,
    infoTxt,
    merchantId,
    onSubmit,
    isOpen,
    onOpenChange,
}: RegistrationPanelProps) {
    return (
        <PanelAccordion
            title="Product Registration"
            className={styles.panel}
            withBadge={step > 2}
            value={isOpen ? "item-1" : ""}
            onValueChange={(value) => onOpenChange(value === "item-1")}
        >
            {step < 3 ? (
                <div className={styles.disabledContent}>
                    <p>Complete validation in the previous step to continue</p>
                </div>
            ) : step === 3 ? (
                <div className={styles.registrationSection}>
                    <h3 className={styles.sectionHeading}>
                        Launch Your Product
                    </h3>
                    <p className={styles.description}>
                        Click below to register your product on the blockchain.
                        This requires authentication with your wallet and will
                        create your product permanently on-chain.
                    </p>
                    <ButtonAuth onClick={onSubmit} disabled={isPending}>
                        Launch Product
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
                        Your product has been successfully registered!
                    </p>
                    {merchantId && <p>Merchant ID: {merchantId}</p>}
                </div>
            )}
        </PanelAccordion>
    );
}
