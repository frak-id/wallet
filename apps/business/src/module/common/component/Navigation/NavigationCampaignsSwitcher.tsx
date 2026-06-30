import { useMediaQuery } from "@frak-labs/design-system/hooks/useMediaQuery";
import {
    ChecklistIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from "@frak-labs/design-system/icons";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptionalActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { pageNav } from "@/module/common/i18n/pageLabel";
import { NavigationItem, SubNavigationItem } from "./NavigationItem";
import { collapsibleContent, itemList } from "./navigation.css";

export function NavigationCampaignsSwitcher({
    disabled,
    tooltip,
}: {
    disabled?: boolean;
    tooltip?: string;
}) {
    const { t } = useTranslation();
    const isMobile = useMediaQuery("(max-width : 768px)");
    const merchantId = useOptionalActiveMerchantId();

    // TODO: remove the legacy fallback once all entry points land users
    // inside a `/m/$merchantId/...` route.
    const listUrl = merchantId
        ? `/m/${merchantId}/campaigns/list`
        : "/campaigns/list";
    const overviewUrl = merchantId
        ? `/m/${merchantId}/campaigns`
        : "/campaigns";

    // No merchant ⇒ every campaigns route bounces to /dashboard; show a single
    // disabled entry (no expandable sub-items) with the reason.
    if (disabled) {
        return (
            <NavigationItem
                disabled
                tooltip={tooltip}
                icon={<ChecklistIcon width={20} height={20} />}
            >
                {pageNav(t, "campaigns")}
            </NavigationItem>
        );
    }

    return isMobile ? (
        <NavigationItem
            url={listUrl}
            icon={<ChecklistIcon width={20} height={20} />}
        >
            {pageNav(t, "campaigns")}
        </NavigationItem>
    ) : (
        <NavigationCampaigns listUrl={listUrl} overviewUrl={overviewUrl} />
    );
}

function NavigationCampaigns({
    listUrl,
    overviewUrl,
}: {
    listUrl: string;
    overviewUrl: string;
}) {
    const { t } = useTranslation();
    const location = useLocation();
    const isCampaignsRoute =
        location.pathname.startsWith("/campaigns") ||
        /^\/m\/[^/]+\/campaigns/.test(location.pathname);
    // Default expanded so campaign sub-items are always one click away,
    // regardless of the current route. Users can still collapse manually.
    const [isOpen, setIsOpen] = useState(true);

    // Never leave the menu collapsed while on a campaigns route.
    useEffect(() => {
        if (isCampaignsRoute) {
            setIsOpen(true);
        }
    }, [isCampaignsRoute]);

    return (
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
            <Collapsible.Trigger asChild>
                <NavigationItem
                    isActive={isCampaignsRoute}
                    icon={<ChecklistIcon width={20} height={20} />}
                    rightSection={
                        isOpen ? (
                            <ChevronUpIcon width={16} height={16} />
                        ) : (
                            <ChevronDownIcon width={16} height={16} />
                        )
                    }
                >
                    {pageNav(t, "campaigns")}
                </NavigationItem>
            </Collapsible.Trigger>
            <Collapsible.Content className={collapsibleContent}>
                <ul className={itemList}>
                    <SubNavigationItem url={overviewUrl} fuzzy={false}>
                        {pageNav(t, "campaignsOverview")}
                    </SubNavigationItem>
                    <SubNavigationItem url={listUrl}>
                        {pageNav(t, "campaignsList")}
                    </SubNavigationItem>
                </ul>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
