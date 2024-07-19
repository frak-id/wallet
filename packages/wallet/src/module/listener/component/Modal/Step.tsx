import { modalStepsAtom } from "@/module/listener/atoms/modalEvents";
import styles from "@/module/listener/component/Modal/index.module.css";
import type { ModalStepTypes } from "@frak-labs/nexus-sdk/core";
import { atom, useAtomValue } from "jotai/index";
import type { PropsWithChildren } from "react";

/**
 * Get the active steps atom
 */
const activeStepAtom = atom((get) => get(modalStepsAtom)?.currentStep ?? 0);

const defaultStepTitlesMap: Record<ModalStepTypes["key"], string> = {
    login: "Login",
    siweAuthenticate: "Authenticate",
    openSession: "Open Session",
    sendTransaction: "Transaction",
};

/**
 * Get the steps to displayed name atoms
 */
const stepsNameAtom = atom((get) => {
    const currentSteps = get(modalStepsAtom);
    if (!currentSteps) return [];
    return currentSteps.steps.map(
        (step) =>
            step.params.metadata?.title ??
            defaultStepTitlesMap[step.key] ??
            "Unknown"
    );
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
