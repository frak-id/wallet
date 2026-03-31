import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowLeftIcon } from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import type { PropsWithChildren, ReactNode } from "react";
import { GlassButton } from "@/module/common/component/GlassButton";
import * as styles from "./index.css";

type BackProps = {
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    /** Override the default back arrow icon. */
    icon?: ReactNode;
};

export function Back({
    children,
    href,
    onClick,
    disabled,
    icon = <ArrowLeftIcon />,
}: PropsWithChildren<BackProps>) {
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
                    <GlassButton
                        icon={icon}
                        disabled={disabled}
                        tabIndex={-1}
                        aria-hidden
                    />
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
                <GlassButton
                    icon={icon}
                    disabled={disabled}
                    tabIndex={-1}
                    aria-hidden
                />
                {children && (
                    <Text as="span" className={styles.actionText}>
                        {children}
                    </Text>
                )}
            </Box>
        </Box>
    );
}
