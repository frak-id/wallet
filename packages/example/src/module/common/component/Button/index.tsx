import css from "!!raw-loader!./index.module.css";
import { Loader } from "@/assets/icons/Loader";
import { Slot } from "@radix-ui/react-slot";
import { cloneElement, forwardRef, isValidElement } from "react";
import type {
    ButtonHTMLAttributes,
    ComponentType,
    ReactElement,
    ReactNode,
} from "react";
import styles from "./index.module.css";

export const cssRaw = css;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?:
        | "primary"
        | "secondary"
        | "outlined"
        | "empty"
        | "submit"
        | "danger"
        | "le-monde"
        | "wired"
        | "l-equipe";
    fontNormal?: boolean;
    fontBold?: boolean;
    fontSize?: "small" | "normal" | "big";
    size?: "none" | "small" | "normal" | "big";
    isLoading?: boolean;
    LeftIcon?: ComponentType<{ className: string }>;
    RightIcon?: ComponentType<{ className: string }>;
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
            LeftIcon,
            RightIcon,
            asChild = false,
            children,
            ...props
        },
        ref
    ) => {
        const variantClass = variant ? styles[variant] : styles.primary;
        const variantClassRaw = variant ? variant : "primary";
        const sizeClass = size ? styles[`size--${size}`] : styles["size--big"];
        const sizeClassRaw = size ? `size--${size}` : "size--big";
        const fontSizeClass = fontSize
            ? styles[`fontSize--${fontSize}`]
            : styles["fontSize--big"];
        const allClassNames = `${styles.button} ${variantClass} ${sizeClass} ${
            fontNormal ? styles.fontNormal : ""
        } ${fontBold ? styles.fontBold : ""} ${fontSizeClass} ${className}`;
        const allClassNamesRaw = `frak-button frak-${variantClassRaw} frak-${sizeClassRaw}`;
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={`${allClassNames} ${allClassNamesRaw}`}
                ref={ref}
                {...props}
            >
                <>
                    {isLoading && <Loader className={styles.loader} />}
                    {LeftIcon && <LeftIcon className={styles.leftIcon} />}
                    {asChild && isValidElement(children)
                        ? cloneElement(
                              children as ReactElement<{ className?: string }>,
                              {
                                  className: allClassNames,
                              }
                          )
                        : children}
                    {RightIcon && <RightIcon className={styles.rightIcon} />}
                </>
            </Comp>
        );
    }
);
Button.displayName = "Button";
