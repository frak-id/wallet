"use client";

import { Cash } from "@/assets/icons/Cash";
import { Gear } from "@/assets/icons/Gear";
import { Home } from "@/assets/icons/Home";
import { Info } from "@/assets/icons/Info";
import { Message } from "@/assets/icons/Message";
import { Users } from "@/assets/icons/Users";
import { Wallet } from "@/assets/icons/Wallet";
import { NavigationCampaigns } from "@/module/common/component/NavigationCampaigns";
import { mergeElement } from "@/module/common/utils/mergeElement";
import { cx } from "class-variance-authority";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function Navigation() {
    return (
        <nav className={styles.navigation}>
            <ul className={styles.navigation__list}>
                <NavigationItem url={"/dashboard"}>
                    <Home /> Dashboard
                </NavigationItem>
                <NavigationCampaigns />
                <NavigationItem url={"/members"}>
                    <Users /> Members
                </NavigationItem>
                <NavigationItem url={"/revenue"}>
                    <Cash /> Revenue
                </NavigationItem>
                <NavigationItem url={"/messenger"}>
                    <Message /> Messenger
                </NavigationItem>
                <NavigationItem
                    url={"/wallet"}
                    className={styles.navigation__itemToBottom}
                >
                    <Wallet /> Wallet
                </NavigationItem>
                <NavigationItem url={"/settings"}>
                    <Gear /> Settings
                </NavigationItem>
                <NavigationItem url={"/help"}>
                    <Info /> Help & FAQ
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
