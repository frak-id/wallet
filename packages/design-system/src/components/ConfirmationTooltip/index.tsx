import clsx from "clsx";
import type { ReactNode } from "react";

import { ProgressCheckIconAnimated } from "../../icons/ProgressCheckIconAnimated";
import { Box } from "../Box";
import { Inline } from "../Inline";
import { Text } from "../Text";
import {
    confirmationTooltipIcon,
    confirmationTooltipPill,
    confirmationTooltipPillExiting,
} from "./confirmationTooltip.css";

type ConfirmationTooltipProps = {
    children: ReactNode;
    icon?: ReactNode;
    /**
     * When true, plays the 200ms exit animation. The caller is responsible
     * for unmounting the component once the exit animation has completed.
     */
    isLeaving?: boolean;
    className?: string;
};

export function ConfirmationTooltip({
    children,
    icon = <ProgressCheckIconAnimated />,
    isLeaving = false,
    className,
}: ConfirmationTooltipProps) {
    return (
        <Box
            role="status"
            aria-live="polite"
            borderRadius="full"
            className={clsx(
                confirmationTooltipPill,
                isLeaving && confirmationTooltipPillExiting,
                className
            )}
        >
            <Inline
                space="xs"
                align="center"
                alignY="center"
                paddingX="l"
                paddingY="s"
                wrap={false}
            >
                <Box as="span" className={confirmationTooltipIcon}>
                    {icon}
                </Box>
                <Text variant="bodySmall" weight="medium" color="onAction">
                    {children}
                </Text>
            </Inline>
        </Box>
    );
}
