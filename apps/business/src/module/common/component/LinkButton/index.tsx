import { button } from "@frak-labs/design-system/components/Button";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ReactNode } from "react";

type ButtonRecipeVariants = NonNullable<RecipeVariants<typeof button>>;
type LinkButtonStyleProps = Pick<
    ButtonRecipeVariants,
    "variant" | "size" | "width" | "fontSize"
>;

export type LinkButtonProps = Omit<LinkProps, "className" | "children"> &
    LinkButtonStyleProps & {
        icon?: ReactNode;
        rightIcon?: ReactNode;
        children: ReactNode;
        onClick?: () => void;
    };

/**
 * LinkButton — TanStack Router `<Link>` styled as a design-system Button.
 * Use this for navigation links that should look like buttons (preserves
 * Link preloading and route detection).
 */
export function LinkButton({
    variant,
    size = "medium",
    width = "auto",
    fontSize,
    icon,
    rightIcon,
    children,
    ...linkProps
}: LinkButtonProps) {
    return (
        <Link
            {...linkProps}
            className={button({ variant, size, width, fontSize })}
        >
            {icon}
            {children}
            {rightIcon}
        </Link>
    );
}
