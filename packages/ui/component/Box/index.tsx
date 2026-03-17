import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
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
        align: {
            start: styles["align--start"],
            center: styles["align--center"],
            end: styles["align--end"],
            stretch: styles["align--stretch"],
            baseline: styles["align--baseline"],
        },
        justify: {
            start: styles["justify--start"],
            center: styles["justify--center"],
            end: styles["justify--end"],
            between: styles["justify--between"],
        },
    },
    defaultVariants: {
        padding: "m",
        direction: "column",
    },
});

type BoxElement = "div" | "ul" | "ol" | "section" | "nav" | "aside" | "span";

type BoxProps = HTMLAttributes<HTMLElement> &
    VariantProps<typeof boxVariants> & {
        as?: BoxElement;
    };

export function Box({
    as: Component = "div",
    padding,
    gap,
    direction,
    align,
    justify,
    className,
    ...props
}: BoxProps) {
    return (
        <Component
            className={boxVariants({
                padding,
                gap,
                direction,
                align,
                justify,
                className,
            })}
            {...props}
        />
    );
}
