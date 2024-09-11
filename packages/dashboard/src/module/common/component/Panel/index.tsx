import { Title } from "@/module/common/component/Title";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { BadgeCheck } from "lucide-react";
import { type HTMLAttributes, type PropsWithChildren, forwardRef } from "react";
import styles from "./index.module.css";

export interface PanelProps
    extends HTMLAttributes<HTMLDivElement>,
        PropsWithChildren<VariantProps<typeof panelVariants>> {
    title?: string;
    withBadge?: boolean;
    className?: string;
}

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

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
    (
        {
            variant,
            title,
            withBadge = true,
            className = "",
            children,
            ...props
        },
        ref
    ) => {
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
    }
);

export function PanelTitle({
    withBadge = true,
    title,
}: { withBadge?: boolean; title?: string }) {
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
