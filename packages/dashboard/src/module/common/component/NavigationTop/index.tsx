import { Calendar } from "@/assets/icons/Calendar";
import { Envelope } from "@/assets/icons/Envelope";
import { Notification } from "@/assets/icons/Notification";
import { Search } from "@/assets/icons/Search";
import { NavigationProfile } from "@/module/common/component/NavigationProfile";
import { NavigationTopItem } from "@/module/common/component/NavigationTopItem";
import styles from "./index.module.css";

export function NavigationTop() {
    return (
        <div className={styles.navigationTop__container}>
            <nav>
                <ul className={styles.navigationTop__list}>
                    <NavigationTopItem url={"/"}>
                        <Search />
                    </NavigationTopItem>
                    <NavigationTopItem url={"/"}>
                        <Calendar />
                    </NavigationTopItem>
                    <NavigationTopItem url={"/"}>
                        <Notification />
                    </NavigationTopItem>
                    <NavigationTopItem url={"/"}>
                        <Envelope />
                    </NavigationTopItem>
                </ul>
            </nav>
            <NavigationProfile />
        </div>
    );
}
