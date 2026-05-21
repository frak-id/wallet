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
    sectionLabel,
    subItem,
    subItemActive,
} from "./navigation.css";

export function Navigation() {
    const { t } = useTranslation();
    return (
        <Stack as="nav" space="none" className={navigation}>
            <div className={logoWrapper}>
                <LogoFrakWithName
                    width={105}
                    height={40}
                    className={logoFull}
                />
                <LogoFrakBadge width={32} height={32} className={logoBadge} />
            </div>

            <Stack space="xs">
                <ul className={itemList}>
                    <NavigationItem
                        url="/dashboard"
                        icon={<TabGridIcon width={20} height={20} />}
                    >
                        {t("shell.nav.dashboard")}
                    </NavigationItem>
                </ul>

                <hr className={divider} />

                <ul className={itemList}>
                    <li className={sectionLabel}>
                        <Text variant="bodySmall" color="tertiary">
                            {t("shell.nav.sectionAcquisition")}
                        </Text>
                    </li>
                    <NavigationCampaignsSwitcher />
                    <NavigationItem
                        url="/members"
                        icon={<PeopleFilledIcon width={20} height={20} />}
                    >
                        {t("shell.nav.members")}
                    </NavigationItem>
                </ul>

                <hr className={divider} />

                <ul className={itemList}>
                    <li className={sectionLabel}>
                        <Text variant="bodySmall" color="tertiary">
                            {t("shell.nav.sectionPreview")}
                        </Text>
                    </li>
                    <NavigationItem
                        url={process.env.FRAK_WALLET_URL}
                        icon={<WalletIcon width={20} height={20} />}
                    >
                        {t("shell.nav.wallet")}
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
