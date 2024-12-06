import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef, ElementType, FC } from "react";
import styles from "./index.module.css";

export interface TitleProps
    extends ComponentPropsWithRef<"h1" | "h2" | "h3" | "h4" | "h5" | "h6">,
        VariantProps<typeof titleVariants> {
    as?: ElementType;
    className?: string;
    classNameText?: string;
    icon?: React.ReactNode;
}

export const titleVariants = cva(styles.title, {
    variants: {
        tag: {
            h2: styles.h2,
            h3: styles.h3,
        },
        size: {
            small: styles["size--small"],
            medium: styles["size--medium"],
            big: styles["size--big"],
        },
    },
    defaultVariants: {
        size: "small",
    },
});

export const Title: FC<TitleProps> = ({
    as: Component = "h2",
    className = "",
    classNameText = "",
    icon,
    tag,
    size,
    children,
    ...props
}) => {
    return (
        <Component
            className={titleVariants({
                tag: Component.toString() as VariantProps<
                    typeof titleVariants
                >["tag"],
                size,
                className,
            })}
            {...props}
        >
            {icon && <span className={styles.title__icon}>{icon}</span>}
            <span className={`${styles.title__text} ${classNameText}`}>
                {children}
            </span>
        </Component>
    );
};
Title.displayName = "Title";
