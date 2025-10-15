import type { VariantProps } from "class-variance-authority";
import { cva, cx } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { isValidElement } from "react";
import { hasClassName } from "../../../utils/hasClassName";
import { mergeElement } from "../../../utils/mergeElement";
import styles from "./index.module.css";

export type TextAreaProps = ComponentPropsWithRef<"textarea"> &
    VariantProps<typeof InputVariants> & {
        classNameWrapper?: string;
        leftSection?: string | ReactNode;
        rightSection?: string | ReactNode;
    };

export const InputVariants = cva(styles.inputWrapper, {
    variants: {
        length: {
            small: styles["inputWrapper--small"],
            medium: styles["inputWrapper--medium"],
            big: styles["inputWrapper--big"],
        },
    },
});

export const TextArea = ({
    ref,
    length,
    className = "",
    classNameWrapper = "",
    leftSection,
    rightSection,
    ...props
}: TextAreaProps) => {
    return (
        <span
            className={`${InputVariants({
                length,
            })} ${classNameWrapper}`}
        >
            {leftSection}
            <textarea
                className={cx(styles.input, className)}
                ref={ref}
                {...props}
            />
            {rightSection && isValidElement(rightSection) ? (
                mergeElement(rightSection, {
                    className: `${styles.rightSection} ${
                        hasClassName(rightSection)
                            ? rightSection.props.className
                            : ""
                    }`,
                })
            ) : (
                <span className={styles.rightSection}>{rightSection}</span>
            )}
        </span>
    );
};
TextArea.displayName = "TextArea";
