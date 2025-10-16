// import { Community } from "@/module/membrs/assets/Community";

import { History, Settings, Wallet } from "lucide-react";
import { NavigationItem } from "@/common/component/NavigationItem";
import styles from "./index.module.css";

export function Navigation() {
    return (
        <nav className={styles.navigation}>
            <ul className={styles.navigation__list}>
                <NavigationItem url={"/wallet"}>
                    <Wallet size={29} />
                </NavigationItem>
                <NavigationItem url={"/history"}>
                    <History size={29} />
                </NavigationItem>
                {/* <NavigationItem url={"/earn"}>
                    <Medal />
                </NavigationItem> */}
                {/* <NavigationItem url={"/membrs"}>
                    <Community />
                </NavigationItem> */}
                <NavigationItem url={"/settings"}>
                    <Settings size={29} />
                </NavigationItem>
            </ul>
        </nav>
    );
}
