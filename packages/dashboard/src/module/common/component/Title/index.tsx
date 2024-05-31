import { type VariantProps, cva } from "class-variance-authority";
import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import styles from "./index.module.css";

export interface TitleProps
    extends HTMLAttributes<HTMLHeadingElement>,
        VariantProps<typeof titleVariants> {
    className?: string;
    classNameText?: string;
    icon?: ReactNode;
    children?: string | ReactNode;
}

export const titleVariants = cva(styles.title, {
    variants: {
        size: {
            small: styles["size--small"],
            medium: styles["size--medium"],
            big: styles["size--big"],
        },
    },
    defaultVariants: {
        size: "medium",
    },
});

export const Title = forwardRef<HTMLHeadingElement, TitleProps>(
    (
        { className = "", classNameText = "", icon, size, children, ...props },
        ref
    ) => {
        return (
            <h2
                ref={ref}
                className={titleVariants({ size, className })}
                {...props}
            >
                {icon && <span className={styles.title__icon}>{icon}</span>}
                <span className={`${styles.title__text} ${classNameText}`}>
                    {children}
                </span>
            </h2>
        );
    }
);
Title.displayName = "Title";
