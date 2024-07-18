import { modalStepsAtom } from "@/module/listener/atoms/modalEvents";
import styles from "@/module/listener/component/Modal/index.module.css";
import { atom, useAtomValue } from "jotai/index";
import type { PropsWithChildren } from "react";

/**
 * Get the active steps atom
 */
const activeStepAtom = atom((get) => get(modalStepsAtom)?.currentStep ?? 0);

/**
 * Get the steps to displayed name atoms
 */
const stepsNameAtom = atom((get) => {
    const currentSteps = get(modalStepsAtom);
    if (!currentSteps) return [];
    return currentSteps.steps.map((step) => {
        switch (step.key) {
            case "login":
                return "Login";
            case "siweAuthenticate":
                return "Authenticate";
            case "sendTransaction":
                return "Transaction";
            default:
                return "Unknown";
        }
    });
});

/**
 * Display the current modal step indicator
 * @constructor
 */
export function ModalStepIndicator() {
    const stepsName = useAtomValue(stepsNameAtom);
    const activeStep = useAtomValue(activeStepAtom);

    if (stepsName.length <= 1) return null;

    return (
        <Steps>
            {stepsName.map((name, index) => (
                <StepItem key={name} isActive={index === activeStep}>
                    {name}
                </StepItem>
            ))}
        </Steps>
    );
}

function Steps({ children }: PropsWithChildren) {
    return <div className={styles.modalListener__steps}>{children}</div>;
}

function StepItem({
    isActive,
    children,
}: PropsWithChildren<{ isActive: boolean }>) {
    return (
        <div
            className={`${styles.modalListener__stepItem} ${isActiveStyle(
                isActive
            )}`}
        >
            {children}
        </div>
    );
}

function isActiveStyle(isActive: boolean) {
    return isActive ? styles["modalListener__stepItem--active"] : "";
}
