"use client";

import { Cash } from "@/assets/icons/Cash";
import { Gear } from "@/assets/icons/Gear";
import { Home } from "@/assets/icons/Home";
import { Info } from "@/assets/icons/Info";
import { Laptop } from "@/assets/icons/Laptop";
import { Message } from "@/assets/icons/Message";
import { Users } from "@/assets/icons/Users";
import { Wallet } from "@/assets/icons/Wallet";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function Navigation() {
    return (
        <nav className={styles.navigation}>
            <ul className={styles.navigation__list}>
                <NavigationItem url={"/dashboard"}>
                    <Home /> Dashboard
                </NavigationItem>
                <NavigationItem url={"/campaigns"}>
                    <Laptop /> Campaigns
                </NavigationItem>
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
    url: string;
    className?: string;
};

function NavigationItem({
    children,
    url,
    className = "",
}: PropsWithChildren<NavigationItemProps>) {
    const router = useRouter();
    const pathname = usePathname();
    const activeClassName = pathname.startsWith(url)
        ? styles["navigationItem__button--active"]
        : "";

    return (
        <li className={className}>
            <button
                type={"button"}
                className={`${styles.navigationItem__button} ${activeClassName}`}
                onClick={() => router.push(url)}
            >
                {children}
            </button>
        </li>
    );
}
