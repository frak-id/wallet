import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    LogoFrakBadge,
    LogoFrakWithName,
    PeopleFilledIcon,
    TabGridIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useOptionalActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { pageNav, sectionLabel } from "@/module/common/i18n/pageLabel";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { NavigationCampaignsSwitcher } from "./NavigationCampaignsSwitcher";
import { NavigationItem, SubNavigationItem } from "./NavigationItem";
import {
    divider,
    itemList,
    logoBadge,
    logoFull,
    logoWrapper,
    navigation,
    sectionLabel as sectionLabelClass,
} from "./navigation.css";

export { NavigationItem, SubNavigationItem };

export function Navigation() {
    const { t } = useTranslation();
    const merchantId = useOptionalActiveMerchantId();
    // Merchant-scoped sections (campaigns, members) bounce back to /dashboard
    // until a merchant exists — disable them and explain why instead of letting
    // the click silently no-op.
    const { isEmpty } = useMyMerchants();
    const noMerchantHint = isEmpty ? t("shell.nav.noMerchantHint") : undefined;
    const dashboardUrl = merchantId
        ? `/m/${merchantId}/dashboard`
        : "/dashboard";
    const membersUrl = merchantId ? `/m/${merchantId}/members` : "/members";
    return (
        <Stack as="nav" space="none" className={navigation}>
            <Link to={dashboardUrl} className={logoWrapper}>
                <LogoFrakWithName
                    width={105}
                    height={40}
                    className={logoFull}
                />
                <LogoFrakBadge width={32} height={32} className={logoBadge} />
            </Link>

            <Stack space="xs">
                <ul className={itemList}>
                    <NavigationItem
                        url={dashboardUrl}
                        icon={<TabGridIcon width={20} height={20} />}
                    >
                        {pageNav(t, "dashboard")}
                    </NavigationItem>
                </ul>

                <hr className={divider} />

                <ul className={itemList}>
                    <li className={sectionLabelClass}>
                        <Text variant="bodySmall" color="tertiary">
                            {sectionLabel(t, "acquisition")}
                        </Text>
                    </li>
                    <NavigationCampaignsSwitcher
                        disabled={isEmpty}
                        tooltip={noMerchantHint}
                    />
                    <NavigationItem
                        url={membersUrl}
                        icon={<PeopleFilledIcon width={20} height={20} />}
                        disabled={isEmpty}
                        tooltip={noMerchantHint}
                    >
                        {pageNav(t, "members")}
                    </NavigationItem>
                </ul>

                <hr className={divider} />

                <ul className={itemList}>
                    <li className={sectionLabelClass}>
                        <Text variant="bodySmall" color="tertiary">
                            {sectionLabel(t, "preview")}
                        </Text>
                    </li>
                    <NavigationItem
                        url={process.env.FRAK_WALLET_URL}
                        icon={<WalletIcon width={20} height={20} />}
                    >
                        {pageNav(t, "wallet")}
                    </NavigationItem>
                </ul>
            </Stack>
        </Stack>
    );
}
