import { Text } from "@frak-labs/design-system/components/Text";
import { Link, useMatchRoute } from "@tanstack/react-router";
import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { Tooltip } from "@/module/common/component/Tooltip";
import {
    item,
    itemActive,
    itemIcon,
    itemLabel,
    itemListEntry,
    itemRight,
    subItem,
    subItemActive,
} from "./navigation.css";

type NavigationItemProps = HTMLAttributes<HTMLElement> & {
    url?: string;
    icon?: ReactNode;
    rightSection?: ReactNode;
    isActive?: boolean;
    disabled?: boolean;
    /** When disabled, an explanation shown on hover/focus. */
    tooltip?: string;
    isSub?: boolean;
    fuzzy?: boolean;
};

export function NavigationItem({
    children,
    url,
    icon,
    rightSection,
    isActive,
    disabled,
    tooltip,
    isSub = false,
    fuzzy = true,
    ...rest
}: PropsWithChildren<NavigationItemProps>) {
    const matchRoute = useMatchRoute();
    const isRouteActive = url ? matchRoute({ to: url, fuzzy }) : false;
    const active = Boolean(isRouteActive || isActive);

    const baseClass = isSub ? subItem : item;
    const activeClass = isSub ? subItemActive : itemActive;
    const className = `${baseClass}${active ? ` ${activeClass}` : ""}`;

    const content = (
        <>
            {icon && <span className={itemIcon}>{icon}</span>}
            <Text
                variant="bodySmall"
                as="span"
                className={itemLabel}
                weight={active ? "medium" : "regular"}
            >
                {children}
            </Text>
            {rightSection && <span className={itemRight}>{rightSection}</span>}
        </>
    );

    if (disabled) {
        // With a tooltip, use `aria-disabled` (not native `disabled`) so the
        // button still receives the hover/focus that opens the tooltip.
        if (tooltip) {
            return (
                <li className={itemListEntry}>
                    <Tooltip content={tooltip} side="right">
                        <button
                            type="button"
                            className={className}
                            {...rest}
                            aria-disabled="true"
                            onClick={(e) => e.preventDefault()}
                        >
                            {content}
                        </button>
                    </Tooltip>
                </li>
            );
        }
        return (
            <li className={itemListEntry}>
                <button type="button" className={className} disabled {...rest}>
                    {content}
                </button>
            </li>
        );
    }

    if (url?.startsWith("http")) {
        return (
            <li className={itemListEntry}>
                <button
                    type="button"
                    className={className}
                    onClick={() =>
                        window.open(url, "_blank", "noopener,noreferrer")
                    }
                    {...rest}
                >
                    {content}
                </button>
            </li>
        );
    }

    if (url) {
        return (
            <li className={itemListEntry}>
                <Link to={url} className={className} {...rest}>
                    {content}
                </Link>
            </li>
        );
    }

    return (
        <li className={itemListEntry}>
            <button type="button" className={className} {...rest}>
                {content}
            </button>
        </li>
    );
}

export function SubNavigationItem(
    props: PropsWithChildren<NavigationItemProps>
) {
    return <NavigationItem {...props} isSub />;
}
