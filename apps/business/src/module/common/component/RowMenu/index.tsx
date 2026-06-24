import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { MoreVerticalIcon } from "@frak-labs/design-system/icons";
import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";
import { type ButtonHTMLAttributes, type ReactNode, useState } from "react";
import * as styles from "./row-menu.css";

type RowMenuRenderProps = { close: () => void };

/**
 * Hover-revealed kebab row-action menu (Popover + trigger + item list). Shared
 * by every table that needs per-row actions (campaigns, push history, …).
 *
 * `children` may be a render function receiving `{ close }` so items can
 * dismiss the menu before opening a dialog or navigating.
 */
export function RowMenu({
    ariaLabel,
    align = "end",
    sideOffset = 6,
    children,
}: {
    ariaLabel: string;
    align?: "start" | "center" | "end";
    sideOffset?: number;
    children: ReactNode | ((props: RowMenuRenderProps) => ReactNode);
}) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={styles.button}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={ariaLabel}
                >
                    <MoreVerticalIcon width={20} height={20} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align={align}
                sideOffset={sideOffset}
                onClick={(e) => e.stopPropagation()}
                className={styles.list}
            >
                {typeof children === "function"
                    ? children({ close: () => setOpen(false) })
                    : children}
            </PopoverContent>
        </Popover>
    );
}

/** Visual grouping of items; pair with `RowMenuDivider` between groups. */
export function RowMenuSection({ children }: { children: ReactNode }) {
    return <div className={styles.section}>{children}</div>;
}

export function RowMenuDivider() {
    return <div className={styles.divider} />;
}

type RowMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Render destructive (red) styling. */
    destructive?: boolean;
    children: ReactNode;
} & ({ asChild: true; icon?: never } | { asChild?: false; icon?: ReactNode }); // its own icon, so the two are mutually exclusive at the type level. // `icon` only applies to the default button; an `asChild` child carries

/**
 * A single menu row. Renders a `<button>` by default (with an optional leading
 * `icon`), or the provided child (via `asChild`) for links / dialog triggers.
 */
export function RowMenuItem({
    destructive,
    className,
    children,
    ...rest
}: RowMenuItemProps) {
    const merged = clsx(
        styles.item,
        destructive && styles.itemDestructive,
        className
    );
    if (rest.asChild) {
        const { asChild: _asChild, icon: _icon, ...props } = rest;
        return (
            <Slot className={merged} {...props}>
                {children}
            </Slot>
        );
    }
    const { asChild: _asChild, icon, ...props } = rest;
    return (
        <button type="button" className={merged} {...props}>
            {icon}
            {children}
        </button>
    );
}
