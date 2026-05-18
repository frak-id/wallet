import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ComponentPropsWithRef } from "react";
import { badgeVariants } from "./badge.css";

type BadgeRecipeVariants = NonNullable<RecipeVariants<typeof badgeVariants>>;

export type BadgeProps = ComponentPropsWithRef<"span"> & BadgeRecipeVariants;

export const Badge = ({
    ref,
    className,
    variant,
    size,
    ...props
}: BadgeProps) => {
    return (
        <span
            className={`${badgeVariants({
                variant,
                size,
            })}${className ? ` ${className}` : ""}`}
            ref={ref}
            {...props}
        />
    );
};

Badge.displayName = "Badge";
