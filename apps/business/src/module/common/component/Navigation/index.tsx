import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    LogoFrakBadge,
    LogoFrakWithName,
    PeopleFilledIcon,
    TabGridIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import { Link, useMatchRoute } from "@tanstack/react-router";
import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useOptionalActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { pageNav, sectionLabel } from "@/module/common/i18n/pageLabel";
import { NavigationCampaignsSwitcher } from "./NavigationCampaignsSwitcher";
import {
    divider,
    item,
    itemActive,
    itemIcon,
    itemLabel,
    itemList,
    itemListEntry,
    itemRight,
    logoBadge,
    logoFull,
    logoWrapper,
    navigation,
    sectionLabel as sectionLabelClass,
    subItem,
    subItemActive,
} from "./navigation.css";

export function Navigation() {
    const { t } = useTranslation();
    const merchantId = useOptionalActiveMerchantId();
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
                    <NavigationCampaignsSwitcher />
                    <NavigationItem
                        url={membersUrl}
                        icon={<PeopleFilledIcon width={20} height={20} />}
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

type NavigationItemProps = HTMLAttributes<HTMLElement> & {
    url?: string;
    icon?: ReactNode;
    rightSection?: ReactNode;
    isActive?: boolean;
    disabled?: boolean;
    isSub?: boolean;
};

export function NavigationItem({
    children,
    url,
    icon,
    rightSection,
    isActive,
    disabled,
    isSub = false,
    ...rest
}: PropsWithChildren<NavigationItemProps>) {
    const matchRoute = useMatchRoute();
    const isRouteActive = url ? matchRoute({ to: url, fuzzy: true }) : false;
    const active = Boolean(isRouteActive || isActive);

    const baseClass = isSub ? subItem : item;
    const activeClass = isSub ? subItemActive : itemActive;
    const className = `${baseClass}${active ? ` ${activeClass}` : ""}`;

    const content = (
        <>
            {icon && <span className={itemIcon}>{icon}</span>}
            <Text
                variant="bodySmall"
                as="span"
                className={itemLabel}
                weight={active ? "medium" : "regular"}
            >
                {children}
            </Text>
            {rightSection && <span className={itemRight}>{rightSection}</span>}
        </>
    );

    if (disabled) {
        return (
            <li className={itemListEntry}>
                <button type="button" className={className} disabled {...rest}>
                    {content}
                </button>
            </li>
        );
    }

    if (url?.startsWith("http")) {
        return (
            <li className={itemListEntry}>
                <button
                    type="button"
                    className={className}
                    onClick={() =>
                        window.open(url, "_blank", "noopener,noreferrer")
                    }
                    {...rest}
                >
                    {content}
                </button>
            </li>
        );
    }

    if (url) {
        return (
            <li className={itemListEntry}>
                <Link to={url} className={className} {...rest}>
                    {content}
                </Link>
            </li>
        );
    }

    return (
        <li className={itemListEntry}>
            <button type="button" className={className} {...rest}>
                {content}
            </button>
        </li>
    );
}

export function SubNavigationItem(
    props: PropsWithChildren<NavigationItemProps>
) {
    return <NavigationItem {...props} isSub />;
}
