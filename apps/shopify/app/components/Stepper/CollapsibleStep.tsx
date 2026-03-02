import { Collapsible } from "app/components/ui/Collapsible";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { StepItem } from ".";

interface CollapsibleStepProps {
    step: number;
    currentStep: number;
    completed: boolean;
    title: string;
    description?: string;
    children?: ReactNode;
}

export function CollapsibleStep({
    step,
    currentStep,
    completed,
    title,
    description,
    children,
}: CollapsibleStepProps) {
    const [open, setOpen] = useState(false);
    const handleToggle = useCallback(() => setOpen((open) => !open), []);

    useEffect(() => {
        // If the step is not completed and the current step is the step, open the collapsible
        if (!completed && currentStep === step) {
            setOpen(true);
            return;
        }
        setOpen(false);
    }, [completed, currentStep, step]);

    return (
        <>
            <StepItem
                checked={completed}
                stepNumber={step}
                currentStep={currentStep}
            >
                {completed ? (
                    <s-text>{title}</s-text>
                ) : currentStep === step ? (
                    <>
                        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: s-button renders as button */}
                        <s-button
                            variant="tertiary"
                            onClick={handleToggle}
                            aria-expanded={open}
                            aria-controls={`stepper-step${step}-collapsible`}
                        >
                            {title}
                        </s-button>
                    </>
                ) : (
                    <s-text color="subdued">{title}</s-text>
                )}
            </StepItem>
            <Collapsible
                open={open}
                id={`stepper-step${step}-collapsible`}
                transition={{
                    duration: "500ms",
                    timingFunction: "ease-in-out",
                }}
            >
                <s-box background="subdued" padding="base">
                    <div style={{ width: "fit-content" }}>
                        <s-stack gap="base">
                            {description && <s-text>{description}</s-text>}
                            {children}
                        </s-stack>
                    </div>
                </s-box>
            </Collapsible>
        </>
    );
}
