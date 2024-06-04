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
    className?: string;
}

export const panelVariants = cva(styles.panel, {
    variants: {
        variant: {
            primary: styles.primary,
            secondary: styles.secondary,
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
    ({ variant, title, className = "", children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={panelVariants({ variant, className })}
                {...props}
            >
                {title && (
                    <Title
                        icon={<BadgeCheck color={"#0DDB84"} />}
                        size={"small"}
                        className={styles.panel__title}
                    >
                        {title}
                    </Title>
                )}
                {children}
            </div>
        );
    }
);
