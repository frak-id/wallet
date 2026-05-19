import type { RecipeVariants } from "@vanilla-extract/recipes";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { badgeClickable, badgeDisabled, badgeVariants } from "./badge.css";

type BadgeRecipeVariants = NonNullable<RecipeVariants<typeof badgeVariants>>;

export type BadgeProps = ComponentPropsWithRef<"span"> &
    BadgeRecipeVariants & {
        disabled?: boolean;
    };

export const Badge = ({
    ref,
    className,
    variant,
    size,
    disabled,
    onClick,
    ...props
}: BadgeProps) => {
    return (
        <span
            className={clsx(
                badgeVariants({ variant, size }),
                disabled && badgeDisabled,
                !disabled && onClick && badgeClickable,
                className
            )}
            ref={ref}
            onClick={disabled ? undefined : onClick}
            {...props}
        />
    );
};

Badge.displayName = "Badge";
