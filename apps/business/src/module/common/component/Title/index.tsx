import type { RecipeVariants } from "@vanilla-extract/recipes";
import clsx from "clsx";
import type { ComponentPropsWithRef, ElementType, ReactNode } from "react";
import { titleIcon, titleText, titleVariants } from "./title.css";

type TitleRecipeVariants = NonNullable<RecipeVariants<typeof titleVariants>>;

export type TitleProps = ComponentPropsWithRef<"h1"> &
    TitleRecipeVariants & {
        as?: ElementType;
        className?: string;
        classNameText?: string;
        icon?: ReactNode;
        children?: string | ReactNode;
    };

export { titleVariants };

export const Title = ({
    ref,
    as: Component = "h2",
    className = "",
    classNameText = "",
    icon,
    tag,
    size,
    children,
    ...props
}: TitleProps) => {
    return (
        <Component
            ref={ref}
            className={clsx(
                titleVariants({
                    tag: Component.toString() as TitleRecipeVariants["tag"],
                    size,
                }),
                className
            )}
            {...props}
        >
            {icon && <span className={titleIcon}>{icon}</span>}
            <span className={clsx(titleText, classNameText)}>{children}</span>
        </Component>
    );
};
Title.displayName = "Title";
