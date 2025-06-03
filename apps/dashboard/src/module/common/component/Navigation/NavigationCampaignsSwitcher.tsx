import { Laptop } from "@/assets/icons/Laptop";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/module/common/component/Collapsible";
import {
    NavigationItem,
    NavigationLabel,
    SubNavigationItem,
} from "@/module/common/component/Navigation";
import { useMediaQuery } from "@shared/module/hook/useMediaQuery";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function NavigationCampaignsSwitcher() {
    const isMobile = useMediaQuery("(max-width : 768px)");
    return isMobile ? (
        <NavigationItem url={"/campaigns/list"}>
            <NavigationLabel icon={<Laptop />}>Campaigns</NavigationLabel>
        </NavigationItem>
    ) : (
        <NavigationCampaigns />
    );
}

const url = "/campaigns";

function NavigationCampaigns() {
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
