"use client";

import { useMediaQuery } from "@frak-labs/ui/hook/useMediaQuery";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown } from "@/assets/icons/ChevronDown";
import { ChevronUp } from "@/assets/icons/ChevronUp";
import { Laptop } from "@/assets/icons/Laptop";
import { NavigationItem, NavigationLabel, SubNavigationItem } from "./index";

export function NavigationCampaignsSwitcher() {
    const isMobile = useMediaQuery("(max-width : 768px)");

    return isMobile ? (
        <NavigationItem url="/campaigns/list">
            <NavigationLabel icon={<Laptop />}>Campaigns</NavigationLabel>
        </NavigationItem>
    ) : (
        <NavigationCampaigns />
    );
}

function NavigationCampaigns() {
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
                    rightSection={isOpen ? <ChevronUp /> : <ChevronDown />}
                >
                    <Laptop /> Campaigns
                </NavigationItem>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <ul>
                    <SubNavigationItem url="/campaigns/list">
                        List
                    </SubNavigationItem>
                    <SubNavigationItem url="/campaigns/performance">
                        Performance
                    </SubNavigationItem>
                </ul>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
