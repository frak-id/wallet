import { Text } from "@frak-labs/design-system/components/Text";
import { Link, useLocation } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
    breadcrumb,
    breadcrumbCurrent,
    breadcrumbLink,
    breadcrumbSeparator,
} from "./header.css";

/**
 * Maps a route segment to its translated label. Falls back to a
 * capitalised version of the segment for dynamic segments (IDs, etc.).
 *
 * Uses a `switch` (not a lookup table) so each `t()` call is literal —
 * the i18next `CustomTypeOptions` augmentation can then narrow the key
 * type and the typecheck catches typos.
 */
function labelFor(segment: string, t: TFunction): string {
    switch (segment) {
        case "dashboard":
            return t("shell.nav.dashboard");
        case "campaigns":
            return t("shell.nav.campaigns");
        case "list":
            return t("shell.nav.campaignsList");
        case "performance":
            return t("shell.nav.campaignsOverview");
        case "members":
            return t("shell.nav.members");
        case "settings":
            return t("settings.title");
        case "merchant":
            return t("shell.breadcrumb.merchant");
        default:
            return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
}

export function HeaderBreadcrumb() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 0) return null;

    return (
        <nav
            aria-label={t("shell.header.breadcrumbLabel")}
            className={breadcrumb}
        >
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
                                {labelFor(segment, t)}
                            </Text>
                        ) : (
                            <Link to={href} className={breadcrumbLink}>
                                <Text as="span" variant="caption">
                                    {labelFor(segment, t)}
                                </Text>
                            </Link>
                        )}
                    </Fragment>
                );
            })}
        </nav>
    );
}
