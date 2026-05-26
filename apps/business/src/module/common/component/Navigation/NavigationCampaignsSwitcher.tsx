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
import { NavigationItem, SubNavigationItem } from "./index";
import { collapsibleContent } from "./navigation.css";

export function NavigationCampaignsSwitcher() {
    const { t } = useTranslation();
    const isMobile = useMediaQuery("(max-width : 768px)");
    const merchantId = useOptionalActiveMerchantId();

    // TODO: remove the legacy fallback once all entry points land users
    // inside a `/m/$merchantId/...` route.
    const listUrl = merchantId
        ? `/m/${merchantId}/campaigns/list`
        : "/campaigns/list";
    const performanceUrl = merchantId
        ? `/m/${merchantId}/campaigns/performance`
        : "/campaigns/performance";

    return isMobile ? (
        <NavigationItem
            url={listUrl}
            icon={<ChecklistIcon width={20} height={20} />}
        >
            {pageNav(t, "campaigns")}
        </NavigationItem>
    ) : (
        <NavigationCampaigns
            listUrl={listUrl}
            performanceUrl={performanceUrl}
        />
    );
}

function NavigationCampaigns({
    listUrl,
    performanceUrl,
}: {
    listUrl: string;
    performanceUrl: string;
}) {
    const { t } = useTranslation();
    const location = useLocation();
    const isCampaignsRoute =
        location.pathname.startsWith("/campaigns") ||
        /^\/m\/[^/]+\/campaigns/.test(location.pathname);
    const [isOpen, setIsOpen] = useState(isCampaignsRoute);

    // Keep menu open when navigating to any campaigns route
    useEffect(() => {
        if (isCampaignsRoute) {
            setIsOpen(true);
        }
    }, [isCampaignsRoute]);

    return (
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
            <Collapsible.Trigger asChild>
                <NavigationItem
                    isActive={isOpen}
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
                <ul>
                    <SubNavigationItem url={performanceUrl}>
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
