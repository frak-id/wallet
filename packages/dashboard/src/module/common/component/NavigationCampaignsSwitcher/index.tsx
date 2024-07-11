import { Laptop } from "@/assets/icons/Laptop";
import {
    NavigationItem,
    NavigationLabel,
} from "@/module/common/component/Navigation";
import { NavigationCampaigns } from "@/module/common/component/NavigationCampaigns";
import { useMediaQuery } from "@module/hook/useMediaQuery";

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
