import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode, SVGProps } from "react";
import * as styles from "./index.css";

export { styles as infoCardStyles };

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Shared card wrapper for grouped rows.
 */
export function InfoCard({
    children,
    variant,
}: {
    children: ReactNode;
    variant?: "elevated" | "muted" | "secondary";
}) {
    return (
        <Card padding="none" variant={variant} className={styles.card}>
            {children}
        </Card>
    );
}

/**
 * A row inside an InfoCard.
 * - With `icon`: renders an icon left of the label
 * - With `href`: renders as an external link (`<a>` with target="_blank")
 * - With `to`: renders as a TanStack Router `<Link>` for internal navigation
 * - With `action`: renders a static row with a right-side action element
 */
export function InfoRow({
    icon: Icon,
    label,
    labelColor,
    labelVariant = "body",
    labelWeight = "medium",
    href,
    to,
    action,
    align = "center",
}: {
    icon?: IconComponent;
    label: string;
    labelColor?: "primary" | "secondary";
    labelVariant?: "body" | "bodySmall";
    labelWeight?: "regular" | "medium" | "semiBold" | "bold";
    href?: string;
    to?: string;
    /**
     * Right-side slot. On `to` rows the action lives inside the `<Link>`,
     * so any click in this slot bubbles up and triggers navigation. Use
     * decorative content (icon + label) here; real buttons that need a
     * different target should `stopPropagation` or live outside InfoRow.
     */
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
            {Icon && <Icon width={24} height={24} className={styles.icon} />}
            <Text
                as="span"
                variant={labelVariant}
                weight={labelWeight}
                color={labelColor}
            >
                {label}
            </Text>
        </Box>
    );

    if (to) {
        return (
            <Link to={to} className={rowClass}>
                {content}
                {action ? <Box className={styles.action}>{action}</Box> : null}
            </Link>
        );
    }

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
