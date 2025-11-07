import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { BadgeCheck } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { Title } from "@/module/common/component/Title";
import styles from "./index.module.css";

export type PanelProps = ComponentPropsWithRef<"div"> &
    VariantProps<typeof panelVariants> & {
        title?: string;
        withBadge?: boolean;
        className?: string;
    };

export const panelVariants = cva(styles.panel, {
    variants: {
        variant: {
            primary: styles.primary,
            secondary: styles.secondary,
            ghost: styles.ghost,
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});

export const Panel = ({
    ref,
    variant,
    title,
    withBadge = true,
    className = "",
    children,
    ...props
}: PanelProps) => {
    return (
        <div
            ref={ref}
            className={panelVariants({ variant, className })}
            {...props}
        >
            <PanelTitle title={title} withBadge={withBadge} />
            {children}
        </div>
    );
};

export function PanelTitle({
    withBadge = true,
    title,
}: {
    withBadge?: boolean;
    title?: string;
}) {
    return (
        title && (
            <Title
                icon={withBadge && <BadgeCheck color={"#0DDB84"} />}
                size={"small"}
                className={styles.panel__title}
            >
                {title}
            </Title>
        )
    );
}
