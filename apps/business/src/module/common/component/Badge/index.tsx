import type { RecipeVariants } from "@vanilla-extract/recipes";
import clsx from "clsx";
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
            className={clsx(badgeVariants({ variant, size }), className)}
            ref={ref}
            {...props}
        />
    );
};

Badge.displayName = "Badge";
