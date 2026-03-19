import type { ReactNode } from "react";
import { Box } from "@/components/Box";
import { Button } from "@/components/Button";
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
            {icon && <Box className={emptyStateStyles.iconWrapper}>{icon}</Box>}
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
                    <Button variant="outlined" onClick={action.onClick}>
                        {action.label}
                    </Button>
                </Box>
            )}
        </Box>
    );
}
