import { mergeElement } from "@frak-labs/ui/utils/mergeElement";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { cx } from "class-variance-authority";
import type { PropsWithChildren, ReactNode } from "react";
import { Cash } from "@/assets/icons/Cash";
import { Gear } from "@/assets/icons/Gear";
import { Home } from "@/assets/icons/Home";
import { Info } from "@/assets/icons/Info";
import { Message } from "@/assets/icons/Message";
import { Users } from "@/assets/icons/Users";
import { Wallet } from "@/assets/icons/Wallet";
import styles from "./index.module.css";
import { NavigationCampaignsSwitcher } from "./NavigationCampaignsSwitcher";

export function Navigation() {
    return (
        <nav className={styles.navigation}>
            <ul className={styles.navigation__list}>
                <NavigationItem url="/dashboard">
                    <NavigationLabel icon={<Home />}>Dashboard</NavigationLabel>
                </NavigationItem>
                <NavigationCampaignsSwitcher />
                <NavigationItem url="/members">
                    <NavigationLabel icon={<Users />}>Members</NavigationLabel>
                </NavigationItem>
                <NavigationItem url="/revenue" disabled={true}>
                    <NavigationLabel icon={<Cash />}>Revenue</NavigationLabel>
                </NavigationItem>
                <NavigationItem url="/messenger" disabled={true}>
                    <NavigationLabel icon={<Message />}>
                        Messenger
                    </NavigationLabel>
                </NavigationItem>
                <NavigationItem
                    url={process.env.FRAK_WALLET_URL}
                    className={styles.navigation__itemToBottom}
                >
                    <NavigationLabel icon={<Wallet />}>Wallet</NavigationLabel>
                </NavigationItem>
                <NavigationItem url="/settings">
                    <NavigationLabel icon={<Gear />}>Settings</NavigationLabel>
                </NavigationItem>
                <NavigationItem url="/help" disabled={true}>
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
    disabled?: boolean;
};

export function NavigationItem({
    children,
    isSub = false,
    url,
    className = "",
    rightSection,
    isActive,
    disabled,
    ...props
}: PropsWithChildren<NavigationItemProps>) {
    const navigate = useNavigate();
    const matchRoute = useMatchRoute();
    const isRouteActive = url ? matchRoute({ to: url, fuzzy: true }) : false;

    const activeClassName =
        isRouteActive || isActive
            ? styles["navigationItem__button--active"]
            : "";

    const handleClick = () => {
        if (!url) return;

        if (url.startsWith("http")) {
            window.open(url, "_blank", "noopener,noreferrer");
        } else {
            navigate({ to: url });
        }
    };

    return (
        <li className={className}>
            <button
                type="button"
                className={cx(
                    styles.navigationItem__button,
                    !isSub && activeClassName
                )}
                disabled={disabled}
                onClick={handleClick}
                {...props}
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

export function NavigationLabel({
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
