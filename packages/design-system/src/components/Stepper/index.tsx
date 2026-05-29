import clsx from "clsx";
import { CheckIcon } from "../../icons";
import { Text } from "../Text";
import * as styles from "./stepper.css";

type StepStatus = "default" | "active" | "completed";

export type StepperStep = {
    title: string;
    description?: string;
};

export type StepperProps = {
    /** Ordered list of steps to display. */
    steps: StepperStep[];
    /** Index of the current (active) step. Steps before it are completed, after it are default. */
    activeStep: number;
    /** When provided, completed steps become clickable to navigate back. */
    onStepClick?: (index: number) => void;
    className?: string;
};

function getStatus(index: number, activeStep: number): StepStatus {
    if (index < activeStep) return "completed";
    if (index === activeStep) return "active";
    return "default";
}

const titleColor = {
    default: "tertiary",
    active: "action",
    completed: "primary",
} as const;

const descriptionColor = {
    default: "disabled",
    active: "secondary",
    completed: "secondary",
} as const;

const statusLabel = {
    default: "upcoming",
    active: "current",
    completed: "completed",
} as const;

export function Stepper({
    steps,
    activeStep,
    onStepClick,
    className,
}: StepperProps) {
    return (
        <ol className={clsx(styles.root, className)}>
            {steps.map((stepItem, index) => {
                const status = getStatus(index, activeStep);
                const isLast = index === steps.length - 1;
                const isClickable = !!onStepClick && status === "completed";

                const content = (
                    <>
                        <span className={styles.indicatorColumn}>
                            <span className={styles.indicator[status]}>
                                {status === "completed" ? (
                                    <CheckIcon className={styles.checkIcon} />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            {!isLast && <Connector status={status} />}
                        </span>
                        <span className={styles.cell}>
                            <Text
                                variant="body"
                                weight="medium"
                                color={titleColor[status]}
                                className={styles.cellText}
                            >
                                {stepItem.title}
                            </Text>
                            {stepItem.description && (
                                <Text
                                    variant="bodySmall"
                                    color={descriptionColor[status]}
                                    className={styles.cellText}
                                >
                                    {stepItem.description}
                                </Text>
                            )}
                        </span>
                    </>
                );

                const ariaLabel = `Step ${index + 1}: ${stepItem.title}, ${statusLabel[status]}`;

                return (
                    <li
                        key={stepItem.title}
                        className={styles.item}
                        aria-label={isClickable ? undefined : ariaLabel}
                        aria-current={status === "active" ? "step" : undefined}
                    >
                        {isClickable ? (
                            <button
                                type="button"
                                className={clsx(
                                    styles.step,
                                    styles.stepInteractive
                                )}
                                onClick={() => onStepClick?.(index)}
                                aria-label={ariaLabel}
                            >
                                {content}
                            </button>
                        ) : (
                            <div className={styles.step}>{content}</div>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

function Connector({ status }: { status: StepStatus }) {
    if (status === "active") {
        return (
            <span className={styles.connectorWrap}>
                <span className={styles.connectorDashed} />
            </span>
        );
    }
    return (
        <span className={styles.connectorWrap}>
            <span className={styles.connectorBase} />
            {status === "completed" && (
                <span className={styles.connectorFill} />
            )}
        </span>
    );
}
