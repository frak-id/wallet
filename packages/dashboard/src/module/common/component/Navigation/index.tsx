"use client";

import { Cash } from "@/assets/icons/Cash";
import { Gear } from "@/assets/icons/Gear";
import { Home } from "@/assets/icons/Home";
import { Info } from "@/assets/icons/Info";
import { Laptop } from "@/assets/icons/Laptop";
import { Message } from "@/assets/icons/Message";
import { Users } from "@/assets/icons/Users";
import { Wallet } from "@/assets/icons/Wallet";
import { NavigationCampaigns } from "@/module/common/component/NavigationCampaigns";
import { mergeElement } from "@/module/common/utils/mergeElement";
import { useMediaQuery } from "@uidotdev/usehooks";
import { cx } from "class-variance-authority";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function Navigation() {
    const isMobile = useMediaQuery("(max-width : 768px)");

    return (
        <nav className={styles.navigation}>
            <ul className={styles.navigation__list}>
                <NavigationItem url={"/dashboard"}>
                    <NavigationLabel icon={<Home />}>Dashboard</NavigationLabel>
                </NavigationItem>
                {isMobile ? (
                    <NavigationItem url={"/campaigns/list"}>
                        <NavigationLabel icon={<Laptop />}>
                            Campaigns
                        </NavigationLabel>
                    </NavigationItem>
                ) : (
                    <NavigationCampaigns />
                )}
                <NavigationItem url={"/members"}>
                    <NavigationLabel icon={<Users />}>Members</NavigationLabel>
                </NavigationItem>
                <NavigationItem url={"/revenue"}>
                    <NavigationLabel icon={<Cash />}>Revenue</NavigationLabel>
                </NavigationItem>
                <NavigationItem url={"/messenger"}>
                    <NavigationLabel icon={<Message />}>
                        Messenger
                    </NavigationLabel>
                </NavigationItem>
                <NavigationItem
                    url={"/wallet"}
                    className={styles.navigation__itemToBottom}
                >
                    <NavigationLabel icon={<Wallet />}>Wallet</NavigationLabel>
                </NavigationItem>
                <NavigationItem url={"/settings"}>
                    <NavigationLabel icon={<Gear />}>Settings</NavigationLabel>
                </NavigationItem>
                <NavigationItem url={"/help"}>
                    <NavigationLabel icon={<Info />}>
                        Help & FAQ
                    </NavigationLabel>
                </NavigationItem>
            </ul>
        </nav>
    );
}

type NavigationItemProps = {
    url?: string;
    className?: string;
    isSub?: boolean;
    rightSection?: ReactNode;
    isActive?: boolean;
};

export function NavigationItem({
    children,
    isSub = false,
    url,
    className = "",
    rightSection,
    isActive,
    ...props
}: PropsWithChildren<NavigationItemProps>) {
    const router = useRouter();
    const pathname = usePathname();
    const activeClassName =
        url && pathname.startsWith(url)
            ? styles["navigationItem__button--active"]
            : "";

    const buttonProps = url
        ? {
              onClick: () => {
                  url && router.push(url);
              },
          }
        : {};

    return (
        <li className={className}>
            <button
                type={"button"}
                className={cx(
                    styles.navigationItem__button,
                    !isSub && activeClassName,
                    isActive && styles["navigationItem__button--active"]
                )}
                {...props}
                {...buttonProps}
            >
                {children}
                {rightSection &&
                    mergeElement(rightSection, {
                        className: styles.navigationItem__rightSection,
                    })}
            </button>
        </li>
    );
}

export function SubNavigationItem({
    children,
    ...props
}: PropsWithChildren<NavigationItemProps>) {
    return (
        <NavigationItem isSub={true} {...props}>
            {children}
        </NavigationItem>
    );
}

function NavigationLabel({
    icon,
    children,
}: PropsWithChildren<{ icon: ReactNode }>) {
    return (
        <>
            {icon}
            <span className={styles.navigationItem__label}>{children}</span>
        </>
    );
}
