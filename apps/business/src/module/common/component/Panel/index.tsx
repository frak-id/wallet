import type { RecipeVariants } from "@vanilla-extract/recipes";
import { BadgeCheck } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { Title } from "@/module/common/component/Title";
import { panelTitle, panelTitleGhost, panelVariants } from "./panel.css";

type PanelRecipeVariants = NonNullable<RecipeVariants<typeof panelVariants>>;

export type PanelProps = ComponentPropsWithRef<"div"> &
    PanelRecipeVariants & {
        title?: string;
        withBadge?: boolean;
        className?: string;
    };

export { panelVariants };

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
            className={`${panelVariants({ variant })}${className ? ` ${className}` : ""}`}
            {...props}
        >
            <PanelTitle title={title} withBadge={withBadge} variant={variant} />
            {children}
        </div>
    );
};

export function PanelTitle({
    withBadge = true,
    title,
    variant,
}: {
    withBadge?: boolean;
    title?: string;
    variant?: PanelRecipeVariants["variant"];
}) {
    return (
        title && (
            <Title
                icon={withBadge && <BadgeCheck color={"#0DDB84"} />}
                size={"small"}
                className={
                    variant === "ghost"
                        ? `${panelTitle} ${panelTitleGhost}`
                        : panelTitle
                }
            >
                {title}
            </Title>
        )
    );
}
