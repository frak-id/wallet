import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Slot } from "@radix-ui/react-slot";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ComponentPropsWithRef, ReactNode, RefObject } from "react";
import { cloneElement, isValidElement } from "react";
import { mergeElement } from "@/module/common/utils/mergeElement";
import { buttonVariants } from "./button.css";

type ButtonRecipeVariants = NonNullable<RecipeVariants<typeof buttonVariants>>;

export type ButtonProps = ComponentPropsWithRef<"button"> &
    ButtonRecipeVariants & {
        isLoading?: boolean;
        leftIcon?: ReactNode;
        rightIcon?: ReactNode;
        asChild?: boolean;
        children?: string | ReactNode;
    };

export { buttonVariants };

export const Button = ({
    ref,
    variant,
    className = "",
    size,
    blur,
    width,
    align,
    gap,
    isLoading,
    leftIcon,
    rightIcon,
    asChild = false,
    type = "button",
    children,
    ...props
}: ButtonProps) => {
    const Comp = asChild ? Slot : "button";

    if (asChild) {
        const buttonClassName = `${buttonVariants({
            variant,
            size,
            blur,
            width,
            align,
            gap,
        })} ${className}`.trim();

        if ((leftIcon || rightIcon) && isValidElement(children)) {
            const existingChildren =
                children.props &&
                typeof children.props === "object" &&
                "children" in children.props
                    ? (children.props.children as ReactNode)
                    : null;
            const mergedChildren = cloneElement(
                children,
                {
                    className: buttonClassName,
                } as Partial<typeof children.props>,
                leftIcon,
                existingChildren,
                rightIcon
            );

            return (
                <Comp
                    className={buttonClassName}
                    ref={ref as RefObject<HTMLButtonElement>}
                    type={type}
                    {...props}
                >
                    {mergedChildren}
                </Comp>
            );
        }

        const mergedChildren = mergeElement(children, {
            className: buttonClassName,
        });

        return (
            <Comp
                className={buttonClassName}
                ref={ref as RefObject<HTMLButtonElement>}
                type={type}
                {...props}
            >
                {mergedChildren}
            </Comp>
        );
    }

    return (
        <Comp
            className={`${buttonVariants({
                variant,
                size,
                blur,
                width,
                align,
                gap,
            })} ${className}`.trim()}
            ref={ref as RefObject<HTMLButtonElement>}
            type={type}
            {...props}
        >
            {isLoading && <Spinner />}
            {leftIcon}
            {children}
            {rightIcon}
        </Comp>
    );
};
Button.displayName = "Button";
