import { Loader } from "@/assets/icons/Loader";
import { Slot } from "@radix-ui/react-slot";
import { cloneElement, forwardRef, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import styles from "./index.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?:
        | "primary"
        | "secondary"
        | "outlined"
        | "empty"
        | "submit"
        | "danger";
    fontNormal?: boolean;
    fontBold?: boolean;
    fontSize?: "small" | "normal" | "big";
    size?: "none" | "small" | "normal" | "big";
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    asChild?: boolean;
    children: string | ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant,
            className = "",
            fontNormal,
            fontBold,
            fontSize,
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
        const variantClass = variant ? styles[variant] : styles.primary;
        const sizeClass = size
            ? styles[`size--${size}`]
            : styles["size--normal"];
        const fontSizeClass = fontSize
            ? styles[`fontSize--${fontSize}`]
            : styles["fontSize--normal"];
        const allClassNames = `${styles.button} ${variantClass} ${sizeClass} ${
            fontNormal ? styles.fontNormal : ""
        } ${fontBold ? styles.fontBold : ""} ${fontSizeClass} ${className}`;
        const Comp = asChild ? Slot : "button";
        return (
            <Comp className={`${allClassNames}`} ref={ref} {...props}>
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
                                  className: allClassNames,
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
