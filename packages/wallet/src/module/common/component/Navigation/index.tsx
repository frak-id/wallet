import { isRunningInProd } from "@/context/common/env";
import { NavigationItem } from "@/module/common/component/NavigationItem";
import { History, RectangleVertical, Settings, Wallet } from "lucide-react";
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
                <NavigationItem url={"/history"}>
                    <History />
                </NavigationItem>
                <NavigationItem url={"/settings"}>
                    <Settings />
                </NavigationItem>
            </ul>
        </nav>
    );
}
