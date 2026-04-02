import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ComponentType, ReactNode, SVGProps } from "react";
import * as styles from "./index.css";

export { styles as settingsCardStyles };

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Shared card wrapper for settings rows
 */
export function SettingsCard({ children }: { children: ReactNode }) {
    return (
        <Card padding="none" className={styles.card}>
            {children}
        </Card>
    );
}

/**
 * A row inside a SettingsCard.
 * - With `href`: renders as a link (`<a>`)
 * - With `action`: renders a static row with a right-side action element
 */
export function SettingsRow({
    icon: Icon,
    label,
    href,
    action,
    align = "center",
}: {
    icon: IconComponent;
    label: string;
    href?: string;
    action?: ReactNode;
    align?: "center" | "top";
}) {
    const isTop = align === "top";
    const rowClass = isTop ? `${styles.row} ${styles.rowTop}` : styles.row;
    const contentClass = isTop
        ? `${styles.rowContent} ${styles.rowContentTop}`
        : styles.rowContent;

    const content = (
        <Box className={contentClass}>
            <Icon width={24} height={24} className={styles.icon} />
            <Text as="span" variant="body" weight="medium">
                {label}
            </Text>
        </Box>
    );

    if (href) {
        const isMailto = href.startsWith("mailto:");
        return (
            <Box
                as="a"
                href={href}
                target={isMailto ? undefined : "_blank"}
                rel={isMailto ? undefined : "noreferrer"}
                className={rowClass}
            >
                {content}
            </Box>
        );
    }

    return (
        <Box className={rowClass}>
            {content}
            {action ? <Box className={styles.action}>{action}</Box> : null}
        </Box>
    );
}
