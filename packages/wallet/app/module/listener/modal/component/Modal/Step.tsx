import {
    type AnyModalKey,
    type DisplayedModalStep,
    displayedRpcModalStepsAtom,
} from "@/module/listener/modal/atoms/modalEvents";
import { activeStepAtom } from "@/module/listener/modal/atoms/modalUtils";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAtomValue } from "jotai/index";
import {
    Fingerprint,
    HandCoins,
    SendHorizonal,
    Share,
    WalletMinimal,
} from "lucide-react";
import { type PropsWithChildren, useMemo } from "react";
import { useModalTranslation } from "../../../hooks/useModalTranslation";

/**
 * Get the right icon for the given step
 * @param step
 */
function getStepIcon(step: DisplayedModalStep<AnyModalKey>) {
    switch (step.key) {
        case "login":
        case "siweAuthenticate":
            return <Fingerprint size={20} />;
        case "openSession":
            return <WalletMinimal size={20} />;
        case "sendTransaction":
            return <SendHorizonal size={20} />;
        case "final":
            // For the final step, check the type of action
            switch (step.params.action.key) {
                case "sharing":
                    return <Share size={20} />;
                case "reward":
                    return <HandCoins size={20} />;
                default:
                    return null;
            }
        default:
            return null;
    }
}

/**
 * Display the current modal step indicator
 * @constructor
 */
export function ModalStepIndicator() {
    const { t } = useModalTranslation();
    const activeStep = useAtomValue(activeStepAtom);
    const currentSteps = useAtomValue(displayedRpcModalStepsAtom)?.steps;

    // Compute the steps data to be displayed
    const stepsData = useMemo(() => {
        if (!currentSteps) return [];
        return currentSteps.map((step) => {
            // Get the name
            let name = step.params.metadata?.title;
            if (!name) {
                const context =
                    step.key === "final" ? step.params.action.key : undefined;
                name = t(`sdk.modal.${step.key}.default.title`, {
                    context,
                });
            }

            return {
                name,
                icon: getStepIcon(step),
            };
        });
    }, [currentSteps, t]);

    if (stepsData.length <= 1) return null;

    return (
        <StepsContainer>
            {stepsData.map(({ name, icon }, index) => (
                <StepItem
                    key={name}
                    isActive={index === activeStep}
                    isDone={index < activeStep}
                >
                    <span
                        className={`${prefixModalCss("step-number")} ${
                            styles.modalListener__stepNumber
                        }`}
                    >
                        <span
                            className={
                                styles.modalListener__stepNumberInnerIcon
                            }
                        >
                            {icon}
                        </span>
                    </span>
                    {name}
                </StepItem>
            ))}
        </StepsContainer>
    );
}

function StepsContainer({ children }: PropsWithChildren) {
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
