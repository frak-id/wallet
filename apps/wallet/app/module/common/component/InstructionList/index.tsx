import { Card } from "@frak-labs/design-system/components/Card";
import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./index.css";

type InstructionStep = {
    title: string;
    description: string;
};

type InstructionListProps = {
    title: string;
    steps: InstructionStep[];
};

/**
 * Numbered instruction list inside a Card.
 * Shared between WelcomeDetail and ExplorerDetail.
 */
export function InstructionList({ title, steps }: InstructionListProps) {
    return (
        <>
            <Text variant="bodySmall" color="secondary">
                {title}
            </Text>
            <Card padding="none">
                <div className={styles.stepList}>
                    {steps.map((step, index) => (
                        <div key={step.title} className={styles.stepRow}>
                            <NumberedCircle number={index + 1} size="sm" />
                            <div className={styles.stepText}>
                                <Text variant="body" weight="semiBold">
                                    {step.title}
                                </Text>
                                <Text variant="bodySmall" color="secondary">
                                    {step.description}
                                </Text>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </>
    );
}
