import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/module/common/component/Button";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import type { MerchantNew } from "@/types/Merchant";
import * as styles from "./mint-merchant.css";

interface ValidationPanelProps {
    form: UseFormReturn<MerchantNew>;
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
                    <Text
                        as="h3"
                        variant="bodySmall"
                        weight="semiBold"
                        color="primary"
                    >
                        Review Your Merchant
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        Please review the information below before proceeding.
                        You'll be able to register your merchant in the next
                        step.
                    </Text>
                    <div className={styles.productSummary}>
                        <Inline space="xs" alignY="baseline">
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                                className={styles.summaryLabel}
                            >
                                Merchant Name:
                            </Text>
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                                color="primary"
                            >
                                {values.name}
                            </Text>
                        </Inline>
                        <Inline space="xs" alignY="baseline">
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                                className={styles.summaryLabel}
                            >
                                Domain:
                            </Text>
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                                color="primary"
                            >
                                {values.domain}
                            </Text>
                        </Inline>
                    </div>
                    <div className={styles.continueSection}>
                        <Button
                            variant={"secondary"}
                            onClick={onPrevious}
                            disabled={!form.formState.isValid}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="secondary"
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
