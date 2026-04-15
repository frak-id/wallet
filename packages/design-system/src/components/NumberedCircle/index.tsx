import clsx from "clsx";

import { Box } from "../Box";
import { colorVariants, sizeVariants } from "./numberedCircle.css";

type NumberedCircleProps = {
    number: number;
    size?: "sm" | "md" | "lg";
    color?: "primary" | "secondary" | "action" | "filled";
    className?: string;
};

export function NumberedCircle({
    number,
    size = "md",
    color = "primary",
    className,
}: NumberedCircleProps) {
    return (
        <Box
            as="span"
            aria-hidden="true"
            className={
                clsx(sizeVariants[size], colorVariants[color], className) ||
                undefined
            }
        >
            {number}
        </Box>
    );
}
