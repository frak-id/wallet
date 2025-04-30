import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode, RefObject } from "react";
import { mergeElement } from "../../utils/mergeElement";
import { Spinner } from "../Spinner";
import styles from "./index.module.css";

export type ButtonProps = ComponentPropsWithRef<"button"> &
    VariantProps<typeof buttonVariants> & {
        isLoading?: boolean;
        leftIcon?: ReactNode;
        rightIcon?: ReactNode;
        asChild?: boolean;
        children?: string | ReactNode;
    };

export const buttonVariants = cva(styles.button, {
    variants: {
        variant: {
            primary: styles.primary,
            secondary: styles.secondary,
            outline: styles.outline,
            ghost: styles.ghost,
            submit: styles.submit,
            danger: styles.danger,
            information: styles.information,
            informationReverse: styles.informationReverse,
            informationOutline: styles.informationOutline,
            trigger: styles.trigger,
        },
        size: {
            none: styles["size--none"],
            small: styles["size--small"],
            medium: styles["size--medium"],
            big: styles["size--big"],
            icon: styles["size--icon"],
        },
        blur: {
            none: styles["blur--none"],
            blur: styles.blur,
        },
        width: {
            auto: styles["width--auto"],
            full: styles["width--full"],
        },
        align: {
            left: styles["align--left"],
            center: styles["align--center"],
            right: styles["align--right"],
        },
        gap: {
            none: styles["gap--none"],
            small: styles["gap--small"],
            medium: styles["gap--medium"],
            big: styles["gap--big"],
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "medium",
        blur: "none",
        width: "auto",
        align: "center",
        gap: "small",
    },
});

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
    return (
        <Comp
            className={buttonVariants({
                variant,
                size,
                blur,
                width,
                align,
                gap,
                className,
            })}
            ref={ref as RefObject<HTMLButtonElement>}
            type={type}
            {...props}
        >
            <>
                {isLoading && <Spinner />}
                {leftIcon}
                {asChild
                    ? mergeElement(children, {
                          className: buttonVariants({
                              variant,
                              size,
                              className,
                          }),
                      })
                    : children}
                {rightIcon}
            </>
        </Comp>
    );
};
Button.displayName = "Button";
