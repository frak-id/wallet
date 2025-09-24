"use client";

import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import type { ProductNew } from "@/types/Product";
import { Button } from "@frak-labs/ui/component/Button";
import type { UseFormReturn } from "react-hook-form";
import styles from "./index.module.css";

interface ValidationPanelProps {
    form: UseFormReturn<ProductNew>;
    step: number;
    onPrevious: () => void;
    onNext: () => void;
}

export function ValidationPanel({
    form,
    step,
    onNext,
    onPrevious,
}: ValidationPanelProps) {
    const values = form.getValues();

    return (
        <PanelAccordion
            title="Validate and Launch"
            className={styles.panel}
            withBadge={step > 2}
            value={step === 2 ? "item-1" : undefined}
        >
            {step === 1 ? (
                <div className={styles.disabledContent}>
                    <p>
                        Complete domain verification in the previous step to
                        continue
                    </p>
                </div>
            ) : step === 2 ? (
                <div className={styles.verifySection}>
                    <p>
                        <strong>Verify your information</strong>
                    </p>
                    <p>
                        I confirm that I want to list "{values.name}" on the
                        following domain:
                        <br />
                        <strong>{values.domain}</strong>
                    </p>
                    <div className={styles.continueSection}>
                        <Button
                            variant="outline"
                            onClick={onPrevious}
                            disabled={!form.formState.isValid}
                        >
                            Previous
                        </Button>
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
                        Information validated for "{values.name}" on{" "}
                        {values.domain}
                    </p>
                </div>
            )}
        </PanelAccordion>
    );
}
