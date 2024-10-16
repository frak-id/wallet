import { Spinner } from "@module/component/Spinner";
import { mergeElement } from "@module/utils/mergeElement";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./index.module.css";

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    asChild?: boolean;
    children?: string | ReactNode;
}

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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
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
        },
        ref
    ) => {
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
                ref={ref}
                type={type}
                {...props}
            >
                <>
                    {isLoading && <Spinner />}
                    {leftIcon &&
                        mergeElement(leftIcon, { className: styles.leftIcon })}
                    {asChild
                        ? mergeElement(children, {
                              className: buttonVariants({
                                  variant,
                                  size,
                                  className,
                              }),
                          })
                        : children}
                    {rightIcon &&
                        mergeElement(rightIcon, {
                            className: styles.rightIcon,
                        })}
                </>
            </Comp>
        );
    }
);
Button.displayName = "Button";
