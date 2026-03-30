import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowLeftIcon } from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";
import glassCircleBg from "./glass-circle.webp";
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
    const glassButton = (
        <Box
            className={`${styles.glassCircle} ${disabled ? styles.backDisabled : ""}`}
        >
            <img src={glassCircleBg} alt="" className={styles.glassImage} />
            <Box as="span" className={styles.glassIcon}>
                <ArrowLeftIcon />
            </Box>
        </Box>
    );

    if (href) {
        return (
            <Box className={styles.back}>
                <Link
                    to={href}
                    aria-disabled={disabled}
                    aria-label={
                        typeof children === "string" ? children : undefined
                    }
                    viewTransition
                    className={styles.actionButton}
                >
                    {glassButton}
                    {children && (
                        <Text as="span" className={styles.actionText}>
                            {children}
                        </Text>
                    )}
                </Link>
            </Box>
        );
    }

    return (
        <Box className={styles.back}>
            <Box
                as="button"
                type="button"
                className={styles.actionButton}
                onClick={onClick}
                disabled={disabled}
                aria-disabled={disabled}
            >
                {glassButton}
                {children && (
                    <Text as="span" className={styles.actionText}>
                        {children}
                    </Text>
                )}
            </Box>
        </Box>
    );
}
