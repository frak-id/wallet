"use client";

import { Button } from "@frak-labs/ui/component/Button";
import type { UseFormReturn } from "react-hook-form";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import type { ProductNew } from "@/types/Product";
import styles from "./index.module.css";

interface ValidationPanelProps {
    form: UseFormReturn<ProductNew>;
    step: number;
    onPrevious: () => void;
    onNext: () => void;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function ValidationPanel({
    form,
    step,
    onNext,
    onPrevious,
    isOpen,
    onOpenChange,
}: ValidationPanelProps) {
    const values = form.getValues();

    return (
        <PanelAccordion
            title="Validate and Launch"
            className={styles.panel}
            withBadge={step > 2}
            value={isOpen ? "item-1" : ""}
            onValueChange={(value) => onOpenChange(value === "item-1")}
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
                    <h3 className={styles.sectionHeading}>
                        Review Your Product
                    </h3>
                    <p className={styles.description}>
                        Please review the information below before proceeding.
                        You'll be able to launch your product in the next step.
                    </p>
                    <div className={styles.productSummary}>
                        <div className={styles.summaryItem}>
                            <span className={styles.summaryLabel}>
                                Product Name:
                            </span>
                            <span className={styles.summaryValue}>
                                {values.name}
                            </span>
                        </div>
                        <div className={styles.summaryItem}>
                            <span className={styles.summaryLabel}>Domain:</span>
                            <span className={styles.summaryValue}>
                                {values.domain}
                            </span>
                        </div>
                    </div>
                    <div className={styles.continueSection}>
                        <Button
                            variant={"informationOutline"}
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
                    Information validated for "{values.name}" on {values.domain}
                </div>
            )}
        </PanelAccordion>
    );
}
