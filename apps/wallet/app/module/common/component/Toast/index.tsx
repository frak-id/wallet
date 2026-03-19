import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Warning } from "@/module/common/component/Warning";
import * as styles from "./index.css";

type ToastProps = {
    text?: string | ReactNode;
    onDismiss?: (e: MouseEvent) => void;
    ariaLabel?: string;
    ariaDismissLabel?: string;
    onClick?: (e: MouseEvent) => void;
    isLoading?: boolean;
};

export function Toast({
    text,
    onDismiss,
    ariaLabel,
    ariaDismissLabel,
    onClick,
    isLoading = false,
}: ToastProps) {
    if (isLoading) {
        return (
            <Box className={styles.toast}>
                <Box className={styles.toastLoading}>
                    <Spinner />
                    <Text as="span">{text}</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box className={styles.toast}>
            <ClickableComponent onClick={onClick} ariaLabel={ariaLabel}>
                <Warning text={text} className={styles.toastWarning} />
            </ClickableComponent>
            <Box className={styles.toastActions}>
                <Box
                    as="button"
                    type="button"
                    onClick={onDismiss}
                    className={styles.toastDismissButton}
                    aria-label={ariaDismissLabel}
                >
                    <X size={16} />
                </Box>
            </Box>
        </Box>
    );
}

/**
 * @description This component is used to wrap the children in a button if there is an onClick prop
 * @param children - The children to wrap
 * @param onClick - The onClick prop
 * @param ariaLabel - The aria-label prop
 * @returns The wrapped children
 */
function ClickableComponent({
    children,
    onClick,
    ariaLabel,
}: {
    children: ReactNode;
    onClick?: (e: MouseEvent) => void;
    ariaLabel?: string;
}) {
    if (onClick) {
        return (
            <Box
                as="button"
                type="button"
                className={styles.toastClickable}
                onClick={onClick}
                aria-label={ariaLabel}
            >
                {children}
            </Box>
        );
    }
    return children;
}
