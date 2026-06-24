import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

type MembersSectionTab = "members" | "push";

/**
 * Navigation tabs shared by the Members and Push notifications pages.
 *
 * Rendered with the `navigation` variant (trackless bar, active tab is a
 * floating white pill, per the "Tabs - Navigation bar" design). The active trigger is
 * a router `Link` so the tabs double as navigation between the two routes; the
 * `value` drives the active pill via Radix's `data-state`.
 */
export function MembersSectionTabs({
    active,
    merchantId,
}: {
    active: MembersSectionTab;
    merchantId: string;
}) {
    const { t } = useTranslation();
    return (
        <Tabs value={active}>
            <TabsList variant="navigation">
                <TabsTrigger value="members" variant="navigation" asChild>
                    <Link to="/m/$merchantId/members" params={{ merchantId }}>
                        {t("members.tabs.members")}
                    </Link>
                </TabsTrigger>
                <TabsTrigger value="push" variant="navigation" asChild>
                    <Link to="/m/$merchantId/push" params={{ merchantId }}>
                        {t("members.tabs.push")}
                    </Link>
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
