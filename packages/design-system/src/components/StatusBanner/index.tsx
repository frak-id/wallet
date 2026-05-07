import type { ReactNode } from "react";
import { WarningCircleIcon } from "../../icons";
import * as styles from "../../styles/statusBanner.css";
import { Box } from "../Box";
import { Inline } from "../Inline";
import { Stack } from "../Stack";
import { Text } from "../Text";

type StatusBannerProps = {
    title: string;
    description?: string;
    /** Custom icon. Defaults to `WarningCircleIcon`. */
    icon?: ReactNode;
    /** ARIA role. `status` (default) for non-disruptive info, `alert` for urgent. */
    role?: "alert" | "status";
    /** Extra class(es) appended to the root container. */
    className?: string;
};

/**
 * Lean, indicative top banner. No CTA, no dismiss — auto-shown by callers
 * while a transient state is active (e.g. offline). Visual language matches
 * `InAppBanner` for consistency.
 */
export function StatusBanner({
    title,
    description,
    icon,
    role = "status",
    className,
}: StatusBannerProps) {
    return (
        <Box
            as="div"
            role={role}
            className={`${styles.container}${className ? ` ${className}` : ""}`}
        >
            <Inline space="xs" alignY="center" wrap={false}>
                <Box display="flex" alignItems="center" flexShrink={0}>
                    {icon ?? <WarningCircleIcon width={20} height={20} />}
                </Box>
                <Stack space="xxs">
                    <Text variant="body" weight="medium" color="onAction">
                        {title}
                    </Text>
                    {description ? (
                        <Text variant="bodySmall" color="onAction">
                            {description}
                        </Text>
                    ) : null}
                </Stack>
            </Inline>
        </Box>
    );
}
