import { type VariantProps, cva } from "class-variance-authority";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export interface TitleProps extends VariantProps<typeof titleVariants> {
    icon?: ReactNode;
    className?: string;
    classNameText?: string;
    children?: string | ReactNode;
}

const titleVariants = cva(styles.title, {
    variants: {
        size: {
            medium: styles["size--medium"],
            big: styles["size--big"],
        },
        align: {
            left: styles["align--left"],
            center: styles["align--center"],
        },
    },
    defaultVariants: {
        size: "medium",
    },
});

export function Title({
    icon,
    className = "",
    classNameText = "",
    size = "medium",
    align = "left",
    children,
}: TitleProps) {
    return (
        <h2 className={titleVariants({ size, align, className })}>
            {icon && <span>{icon}</span>}
            <span className={`${styles.title__text} ${classNameText}`}>
                {children}
            </span>
        </h2>
    );
}
