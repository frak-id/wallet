import { Community } from "@/assets/icons/Community";
import { isRunningInProd } from "@/context/common/env";
import { NavigationItem } from "@/module/common/component/NavigationItem";
import { History, RectangleVertical, Wallet } from "lucide-react";
import styles from "./index.module.css";

export function Navigation() {
    return (
        <nav className={styles.navigation}>
            <ul className={styles.navigation__list}>
                <NavigationItem url={"/wallet"}>
                    <Wallet />
                </NavigationItem>
                {isRunningInProd ? null : (
                    <NavigationItem url={"/nfts"}>
                        <RectangleVertical />
                    </NavigationItem>
                )}
                <NavigationItem url={"/membrs"}>
                    <Community />
                </NavigationItem>
                <NavigationItem url={"/history"}>
                    <History />
                </NavigationItem>
            </ul>
        </nav>
    );
}
