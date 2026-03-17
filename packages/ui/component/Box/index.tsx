import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const boxVariants = cva(styles.box, {
    variants: {
        padding: {
            none: styles["padding--none"],
            xs: styles["padding--xs"],
            s: styles["padding--s"],
            m: styles["padding--m"],
            l: styles["padding--l"],
            xl: styles["padding--xl"],
        },
        gap: {
            none: styles["gap--none"],
            xs: styles["gap--xs"],
            s: styles["gap--s"],
            m: styles["gap--m"],
            l: styles["gap--l"],
            xl: styles["gap--xl"],
        },
        direction: {
            row: styles["direction--row"],
            column: styles["direction--column"],
        },
    },
    defaultVariants: {
        padding: "m",
        direction: "column",
    },
});

type BoxProps = ComponentPropsWithRef<"div"> & VariantProps<typeof boxVariants>;

export function Box({
    padding,
    gap,
    direction,
    className,
    ...props
}: BoxProps) {
    return (
        <div
            className={boxVariants({ padding, gap, direction, className })}
            {...props}
        />
    );
}
