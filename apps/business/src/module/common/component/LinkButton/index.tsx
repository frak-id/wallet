import { buttonVariants } from "@frak-labs/ui/component/Button";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

export type LinkButtonProps = Omit<LinkProps, "className" | "children"> &
    VariantProps<typeof buttonVariants> & {
        leftIcon?: ReactNode;
        rightIcon?: ReactNode;
        children: ReactNode;
        onClick?: () => void;
    };

/**
 * LinkButton - A Link component styled as a Button
 *
 * Use this for navigation links that should look like buttons.
 * This component properly supports TanStack Router's preloading,
 * unlike Button with asChild which breaks Link detection.
 *
 * @example
 * ```tsx
 * <LinkButton to="/campaigns/new" leftIcon={<Plus />}>
 *   Create Campaign
 * </LinkButton>
 * ```
 */
export function LinkButton({
    variant,
    size,
    blur,
    width,
    align,
    gap,
    leftIcon,
    rightIcon,
    children,
    ...linkProps
}: LinkButtonProps) {
    return (
        <Link
            {...linkProps}
            className={buttonVariants({
                variant,
                size,
                blur,
                width,
                align,
                gap,
            })}
        >
            {leftIcon}
            {children}
            {rightIcon}
        </Link>
    );
}
