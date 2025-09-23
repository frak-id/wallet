import { Panel } from "@/module/common/component/Panel";
import type { ProductNew } from "@/types/Product";
import { Button } from "@frak-labs/ui/component/Button";
import type { UseFormReturn } from "react-hook-form";
import styles from "./index.module.css";

interface ValidationPanelProps {
    form: UseFormReturn<ProductNew>;
    step: number;
    isDomainValid: boolean;
    onNext: () => void;
}

export function ValidationPanel({
    form,
    step,
    isDomainValid,
    onNext,
}: ValidationPanelProps) {
    return (
        <Panel
            title="Validate and Launch"
            className={`${styles.panel} ${
                !isDomainValid ? styles.panelDisabled : ""
            } ${step > 1 ? styles.panelLocked : ""}`}
        >
            {!isDomainValid ? (
                <div className={styles.disabledContent}>
                    <p>
                        Complete domain verification in the previous step to
                        continue
                    </p>
                </div>
            ) : step === 1 ? (
                <div className={styles.verifySection}>
                    <p>
                        <strong>Verify your information</strong>
                    </p>
                    <p>
                        I confirm that I want to list "{form.getValues().name}"
                        on the following domain:
                        <br />
                        <strong>{form.getValues().domain}</strong>
                    </p>
                    <div className={styles.continueSection}>
                        <Button
                            variant="information"
                            onClick={onNext}
                            disabled={!form.formState.isValid}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            ) : (
                <div className={styles.lockedContent}>
                    <p>
                        Information validated for "{form.getValues().name}" on{" "}
                        {form.getValues().domain}
                    </p>
                </div>
            )}
        </Panel>
    );
}
