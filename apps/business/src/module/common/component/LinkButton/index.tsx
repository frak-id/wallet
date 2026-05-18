import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ReactNode } from "react";
import { buttonVariants } from "@/module/common/component/Button";

type ButtonRecipeVariants = NonNullable<RecipeVariants<typeof buttonVariants>>;

export type LinkButtonProps = Omit<LinkProps, "className" | "children"> &
    ButtonRecipeVariants & {
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
