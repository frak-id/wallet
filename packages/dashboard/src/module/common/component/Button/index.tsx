import { Loader } from "@/assets/icons/Loader";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { cloneElement, forwardRef, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
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
                {...props}
            >
                <>
                    {isLoading && <Loader className={styles.loader} />}
                    {leftIcon && isValidElement(leftIcon)
                        ? cloneElement(
                              leftIcon as ReactElement<{ className?: string }>,
                              { className: styles.leftIcon }
                          )
                        : leftIcon}
                    {asChild && isValidElement(children)
                        ? cloneElement(
                              children as ReactElement<{ className?: string }>,
                              {
                                  className: buttonVariants({
                                      variant,
                                      size,
                                      className,
                                  }),
                              }
                          )
                        : children}
                    {rightIcon && isValidElement(rightIcon)
                        ? cloneElement(
                              rightIcon as ReactElement<{ className?: string }>,
                              { className: styles.leftIcon }
                          )
                        : rightIcon}
                </>
            </Comp>
        );
    }
);
Button.displayName = "Button";
