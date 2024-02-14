import { History, Settings, Wallet } from "lucide-react";
import styles from "./index.module.css";
import { NavigationItem } from "@/module/common/component/NavigationItem";

export function Navigation() {
    return (
        <nav>
            <ul className={styles.navigation__list}>
                <NavigationItem url={"/wallet"}>
                    <Wallet />
                </NavigationItem>
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
