import { Text } from "@frak-labs/design-system/components/Text";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { pageNav } from "@/module/common/i18n/pageLabel";
import {
    breadcrumb,
    breadcrumbCurrent,
    breadcrumbLink,
    breadcrumbSeparator,
} from "./header.css";
import { MerchantSwitcher } from "./MerchantSwitcher";

/**
 * Maps a route segment to its translated label. Falls back to a
 * capitalised version of the segment for dynamic segments (IDs, etc.).
 */
function labelFor(segment: string, t: TFunction): string {
    switch (segment) {
        case "dashboard":
            return pageNav(t, "dashboard");
        case "campaigns":
            return pageNav(t, "campaigns");
        case "list":
            return pageNav(t, "campaignsList");
        case "performance":
            return pageNav(t, "campaignsOverview");
        case "members":
            return pageNav(t, "members");
        case "push":
            return pageNav(t, "push");
        case "create":
            return pageNav(t, "pushCreate");
        case "confirm":
            return pageNav(t, "pushConfirm");
        case "settings":
            return pageNav(t, "settings");
        case "merchant":
            return pageNav(t, "merchant");
        default:
            return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
}

export function HeaderBreadcrumb() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const params = useParams({ strict: false }) as {
        merchantId?: string;
    };

    const rawSegments = pathname.split("/").filter(Boolean);

    // Strip the `/m/$merchantId` prefix — the switcher renders in its place.
    const segments = (() => {
        if (params.merchantId && rawSegments[0] === "m") {
            return rawSegments.slice(2);
        }
        return rawSegments;
    })();

    const hasSwitcher = Boolean(params.merchantId);

    if (segments.length === 0 && !hasSwitcher) return null;

    return (
        <nav
            aria-label={t("shell.header.breadcrumbLabel")}
            className={breadcrumb}
        >
            {hasSwitcher && <MerchantSwitcher />}
            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                const tail = segments.slice(0, index + 1).join("/");
                const href = params.merchantId
                    ? `/m/${params.merchantId}/${tail}`
                    : `/${tail}`;
                return (
                    <Fragment key={href}>
                        {(hasSwitcher || index > 0) && (
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
