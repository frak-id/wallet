import { Text } from "@frak-labs/design-system/components/Text";
import { Link, useLocation } from "@tanstack/react-router";
import { Fragment } from "react";
import {
    breadcrumb,
    breadcrumbCurrent,
    breadcrumbLink,
    breadcrumbSeparator,
} from "./header.css";

/**
 * Maps a route segment to its display label. Falls back to a
 * capitalised version of the segment when not listed.
 */
const SEGMENT_LABELS: Record<string, string> = {
    dashboard: "Dashboard",
    campaigns: "Campaigns",
    list: "List",
    performance: "Datas overview",
    members: "Members",
    settings: "Settings",
    merchant: "Merchant",
};

function labelFor(segment: string) {
    return (
        SEGMENT_LABELS[segment] ??
        segment.charAt(0).toUpperCase() + segment.slice(1)
    );
}

export function HeaderBreadcrumb() {
    const { pathname } = useLocation();
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 0) return null;

    return (
        <nav aria-label="Breadcrumb" className={breadcrumb}>
            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                const href = `/${segments.slice(0, index + 1).join("/")}`;
                return (
                    <Fragment key={href}>
                        {index > 0 && (
                            <span
                                aria-hidden="true"
                                className={breadcrumbSeparator}
                            >
                                /
                            </span>
                        )}
                        {isLast ? (
                            <Text
                                as="span"
                                variant="caption"
                                className={breadcrumbCurrent}
                            >
                                {labelFor(segment)}
                            </Text>
                        ) : (
                            <Link to={href} className={breadcrumbLink}>
                                <Text as="span" variant="caption">
                                    {labelFor(segment)}
                                </Text>
                            </Link>
                        )}
                    </Fragment>
                );
            })}
        </nav>
    );
}
