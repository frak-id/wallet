import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./wizardFieldCard.css";

type WizardFieldCardProps = {
    /**
     * Field label (Body-Secondary / Medium, secondary colour). Omit when the
     * control inside (e.g. a DS `Input`/`TextArea`) renders its own composed
     * `label` — the card then wraps the field with no header.
     */
    label?: string;
    /** Optional hint under the label (Footnote, tertiary colour). */
    description?: string;
    /** Gap between the header and the content. */
    space?: "m" | "xs" | "none";
    /** Inset the header 16px to align with an input field's text. */
    insetLabel?: boolean;
    children: ReactNode;
};

/**
 * The shared white card used by every campaign-wizard field: a label (+
 * optional description) header above the control.
 */
export function WizardFieldCard({
    label,
    description,
    space = "m",
    insetLabel = false,
    children,
}: WizardFieldCardProps) {
    if (!label) {
        return (
            <Card radius="m">
                <Stack space={space}>{children}</Stack>
            </Card>
        );
    }
    const headerClass = insetLabel ? styles.inset : undefined;
    return (
        <Card radius="m">
            <Stack space={space}>
                <Stack space="xxs">
                    <Text
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                        className={headerClass}
                    >
                        {label}
                    </Text>
                    {description ? (
                        <Text
                            variant="caption"
                            color="tertiary"
                            className={headerClass}
                        >
                            {description}
                        </Text>
                    ) : null}
                </Stack>
                {children}
            </Stack>
        </Card>
    );
}
