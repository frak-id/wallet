import type { ReactNode } from "react";
import { Box } from "../Box";
import { Button } from "../Button";
import { IconCircle } from "../IconCircle";
import { emptyStateStyles } from "./emptyState.css";

type EmptyStateAction = {
    label: string;
    onClick: () => void;
};

type EmptyStateProps = {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: EmptyStateAction;
};

export function EmptyState({
    icon,
    title,
    description,
    action,
}: EmptyStateProps) {
    return (
        <Box className={emptyStateStyles.container}>
            {icon && <IconCircle>{icon}</IconCircle>}
            <Box as="h3" className={emptyStateStyles.title}>
                {title}
            </Box>
            {description && (
                <Box as="p" className={emptyStateStyles.description}>
                    {description}
                </Box>
            )}
            {action && (
                <Box className={emptyStateStyles.actionWrapper}>
                    <Button variant="secondary" onClick={action.onClick}>
                        {action.label}
                    </Button>
                </Box>
            )}
        </Box>
    );
}
