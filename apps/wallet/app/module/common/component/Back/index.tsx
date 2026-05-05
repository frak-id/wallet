import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowLeftIcon } from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import type { PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
    // Use the visible children as label when it's a plain string; otherwise
    // fall back to a generic "Back" string so icon-only renders still have
    // an accessible name.
    const ariaLabel =
        typeof children === "string" ? children : t("common.back");

    if (href) {
        return (
            <Box>
                <Link
                    to={href}
                    aria-disabled={disabled}
                    aria-label={ariaLabel}
                    viewTransition
                    className={styles.actionButton}
                >
                    <GlassButton icon={icon} disabled={disabled} />
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
        <Box>
            <Box
                as="button"
                type="button"
                className={styles.actionButton}
                onClick={onClick}
                disabled={disabled}
                aria-disabled={disabled}
                aria-label={ariaLabel}
            >
                <GlassButton icon={icon} disabled={disabled} />
                {children && (
                    <Text as="span" className={styles.actionText}>
                        {children}
                    </Text>
                )}
            </Box>
        </Box>
    );
}
