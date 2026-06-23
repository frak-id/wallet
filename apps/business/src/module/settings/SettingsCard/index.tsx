import {
    Card,
    CardDescription,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { ReactNode } from "react";
import * as styles from "./settings-card.css";

type Emphasis = "section" | "cell";

/**
 * `section` — quiet grouping label (14px secondary + 12px tertiary description),
 * used by the Wallet/Currency/Language cards.
 * `cell` — primary 16px title + 14px description, used by the Demo Mode cell
 * where the row reads as a single setting with a control on the right.
 */
const titleStyle = {
    section: { variant: "bodySmall", color: "secondary" },
    cell: { variant: "body", color: "primary" },
} as const;

const descriptionStyle = {
    section: { variant: "caption", color: "tertiary" },
    cell: { variant: "bodySmall", color: "secondary" },
} as const;

type SettingsCardProps = {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    emphasis?: Emphasis;
    children?: ReactNode;
};

export function SettingsCard({
    title,
    description,
    action,
    emphasis = "section",
    children,
}: SettingsCardProps) {
    const hasHeader = Boolean(title || description || action);
    return (
        <Card variant="elevated" radius="m">
            <Stack space="xs">
                {hasHeader && (
                    <div className={styles.header}>
                        <div className={styles.headerText}>
                            {title && (
                                <CardTitle
                                    as="span"
                                    variant={titleStyle[emphasis].variant}
                                    weight="medium"
                                    color={titleStyle[emphasis].color}
                                >
                                    {title}
                                </CardTitle>
                            )}
                            {description && (
                                <CardDescription
                                    variant={descriptionStyle[emphasis].variant}
                                    color={descriptionStyle[emphasis].color}
                                >
                                    {description}
                                </CardDescription>
                            )}
                        </div>
                        {action && (
                            <div className={styles.action}>{action}</div>
                        )}
                    </div>
                )}
                {children}
            </Stack>
        </Card>
    );
}
