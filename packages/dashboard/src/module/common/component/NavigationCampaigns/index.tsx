"use client";

import { Laptop } from "@/assets/icons/Laptop";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/module/common/component/Collapsible";
import {
    NavigationItem,
    SubNavigationItem,
} from "@/module/common/component/Navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const url = "/campaigns";

export function NavigationCampaigns() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(pathname.startsWith(url));

    useEffect(() => {
        setIsOpen(pathname.startsWith(url));
    }, [pathname]);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                <NavigationItem
                    isActive={isOpen}
                    rightSection={
                        isOpen ? (
                            <ChevronUp size={22} />
                        ) : (
                            <ChevronDown size={22} />
                        )
                    }
                >
                    <Laptop /> Campaigns
                </NavigationItem>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <ul>
                    <SubNavigationItem url={`${url}/list`}>
                        List
                    </SubNavigationItem>
                    <SubNavigationItem url={`${url}/performance`}>
                        Performance
                    </SubNavigationItem>
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
}
