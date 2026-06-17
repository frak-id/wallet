import type { ReactNode } from "react";
import { ExclamationCircleIcon } from "../../icons";
import { Box } from "../Box";
import { Text } from "../Text";
import * as styles from "./fieldError.css";

type FieldErrorProps = {
    children?: ReactNode;
    className?: string;
    /** Forwarded to the root so callers can wire `aria-describedby`. */
    id?: string;
};

/**
 * Inline field-error hint: an exclamation-circle icon followed by the message
 * in the error colour. Renders nothing when it has no message, so callers can
 * mount it unconditionally below a field and feed it the current error.
 */
export function FieldError({ children, className, id }: FieldErrorProps) {
    if (!children) {
        return null;
    }
    return (
        <Box
            as="span"
            id={id}
            className={`${styles.root}${className ? ` ${className}` : ""}`}
        >
            <ExclamationCircleIcon
                width={12}
                height={12}
                className={styles.icon}
            />
            <Text variant="caption" className={styles.message}>
                {children}
            </Text>
        </Box>
    );
}
