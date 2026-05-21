import type { RecipeVariants } from "@vanilla-extract/recipes";
import clsx from "clsx";
import type { ComponentPropsWithRef, KeyboardEvent } from "react";
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
    onKeyDown,
    ...props
}: BadgeProps) => {
    const isInteractive = !disabled && !!onClick;
    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        onKeyDown?.(event);
        if (!isInteractive || event.defaultPrevented) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick?.(event as unknown as React.MouseEvent<HTMLSpanElement>);
        }
    };
    return (
        <span
            className={clsx(
                badgeVariants({ variant, size }),
                disabled && badgeDisabled,
                isInteractive && badgeClickable,
                className
            )}
            ref={ref}
            onClick={disabled ? undefined : onClick}
            onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
            role={isInteractive ? "button" : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            {...props}
        />
    );
};

Badge.displayName = "Badge";
