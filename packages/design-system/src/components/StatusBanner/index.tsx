import type { ReactNode } from "react";
import { CloseIcon, WarningCircleIcon } from "../../icons";
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
    /** When provided, renders a trailing dismiss button that calls this handler. */
    onDismiss?: () => void;
    /** Accessible label for the dismiss button. Required when `onDismiss` is set. */
    dismissLabel?: string;
};

/**
 * Lean, indicative top banner. Visual language matches `InAppBanner` for
 * consistency. Pass `onDismiss` (+ `dismissLabel`) to opt into a trailing
 * close button — callers own the dismissal semantics (hide-only vs.
 * remove-the-underlying-state).
 */
export function StatusBanner({
    title,
    description,
    icon,
    role = "status",
    className,
    onDismiss,
    dismissLabel,
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
                <Box flexGrow={1}>
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
                </Box>
                {onDismiss ? (
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label={dismissLabel}
                        className={styles.dismissButton}
                    >
                        <CloseIcon width={20} height={20} />
                    </button>
                ) : null}
            </Inline>
        </Box>
    );
}
