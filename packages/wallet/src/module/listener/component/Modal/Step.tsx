import { modalStepsAtom } from "@/module/listener/atoms/modalEvents";
import styles from "@/module/listener/component/Modal/index.module.css";
import type { ModalStepTypes } from "@frak-labs/nexus-sdk/core";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { atom, useAtomValue } from "jotai/index";
import { Fingerprint, SendHorizonal, Share, WalletMinimal } from "lucide-react";
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
    final: "Success",
};

function getStepIcon(step: ModalStepTypes) {
    switch (step.key) {
        case "login":
        case "siweAuthenticate":
            return <Fingerprint size={20} />;
        case "openSession":
            return <WalletMinimal size={20} />;
        case "sendTransaction":
            return <SendHorizonal size={20} />;
        case "final":
            if (step.params.action.key === "sharing") {
                return <Share size={20} />;
            }
            return null;
        default:
            return null;
    }
}

/**
 * Get the steps to displayed name atoms
 */
const stepsNameAtom = atom((get) => {
    const currentSteps = get(modalStepsAtom);
    if (!currentSteps) return [];
    return currentSteps.steps.map((step) => {
        return {
            name:
                step.params.metadata?.title ??
                defaultStepTitlesMap[step.key] ??
                "Unknown",
            icon: getStepIcon(step as ModalStepTypes),
        };
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
                <StepItem
                    key={name.name}
                    isActive={index === activeStep}
                    isDone={index < activeStep}
                >
                    <span
                        className={`${prefixModalCss("step-number")} ${
                            styles.modalListener__stepNumber
                        }`}
                    >
                        {name.icon}
                    </span>
                    {name.name}
                </StepItem>
            ))}
        </Steps>
    );
}

function Steps({ children }: PropsWithChildren) {
    return (
        <div
            className={`${prefixModalCss("steps")} ${styles.modalListener__steps}`}
        >
            {children}
        </div>
    );
}

function StepItem({
    isActive,
    isDone,
    children,
}: PropsWithChildren<{ isActive: boolean; isDone: boolean }>) {
    return (
        <div
            className={`${prefixModalCss("step")} ${
                styles.modalListener__stepItem
            } ${isActiveStyle(isActive)} ${isDoneStyle(isDone)}`}
        >
            {children}
        </div>
    );
}

function isActiveStyle(isActive: boolean) {
    return isActive
        ? `${prefixModalCss("step-active")} ${
              styles["modalListener__stepItem--active"]
          }`
        : "";
}

function isDoneStyle(isDone: boolean) {
    return isDone
        ? `${prefixModalCss("step-done")} ${
              styles["modalListener__stepItem--done"]
          }`
        : "";
}
