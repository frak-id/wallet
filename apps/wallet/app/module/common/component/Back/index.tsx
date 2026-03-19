import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { PropsWithChildren } from "react";
import * as styles from "./index.css";

type BackProps = {
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
};

export function Back({
    children,
    href,
    onClick,
    disabled,
}: PropsWithChildren<BackProps>) {
    return (
        <Box
            className={`${styles.back} ${disabled ? styles.backDisabled : ""}`}
        >
            <ArrowLeft />
            {href && (
                <Link
                    to={href}
                    aria-disabled={disabled}
                    viewTransition
                    className={styles.actionButton}
                >
                    <Text as="span" className={styles.actionText}>
                        {children}
                    </Text>
                </Link>
            )}
            {onClick && (
                <Box
                    as="button"
                    type="button"
                    className={styles.actionButton}
                    onClick={onClick}
                    disabled={disabled}
                    aria-disabled={disabled}
                >
                    <Text as="span" className={styles.actionText}>
                        {children}
                    </Text>
                </Box>
            )}
        </Box>
    );
}
