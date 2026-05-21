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
import { NavigationItem, SubNavigationItem } from "./index";
import { collapsibleContent } from "./navigation.css";

export function NavigationCampaignsSwitcher() {
    const { t } = useTranslation();
    const isMobile = useMediaQuery("(max-width : 768px)");

    return isMobile ? (
        <NavigationItem
            url="/campaigns/list"
            icon={<ChecklistIcon width={20} height={20} />}
        >
            {t("shell.nav.campaigns")}
        </NavigationItem>
    ) : (
        <NavigationCampaigns />
    );
}

function NavigationCampaigns() {
    const { t } = useTranslation();
    const location = useLocation();
    const isCampaignsRoute = location.pathname.startsWith("/campaigns");
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
                    {t("shell.nav.campaigns")}
                </NavigationItem>
            </Collapsible.Trigger>
            <Collapsible.Content className={collapsibleContent}>
                <ul>
                    <SubNavigationItem url="/campaigns/performance">
                        {t("shell.nav.campaignsOverview")}
                    </SubNavigationItem>
                    <SubNavigationItem url="/campaigns/list">
                        {t("shell.nav.campaignsList")}
                    </SubNavigationItem>
                </ul>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
