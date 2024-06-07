import { Loader } from "@/assets/icons/Loader";
import { mergeElement } from "@/module/common/utils/mergeElement";
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
            informationOutline: styles.informationOutline,
        },
        size: {
            none: styles["size--none"],
            small: styles["size--small"],
            medium: styles["size--medium"],
            big: styles["size--big"],
            icon: styles["size--icon"],
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "medium",
    },
});

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant,
            className = "",
            size,
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
                className={buttonVariants({ variant, size, className })}
                ref={ref}
                type={type}
                {...props}
            >
                <>
                    {isLoading && <Loader className={styles.loader} />}
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
