import { ButtonRefresh } from "@frak-labs/ui/component/ButtonRefresh";
import { DemoModeBadge } from "@/module/common/component/DemoModeBadge";
import { NavigationProfile } from "@/module/common/component/NavigationProfile";
import styles from "./index.module.css";

export function NavigationTop() {
    return (
        <div className={styles.navigationTop__container}>
            <DemoModeBadge />
            <ButtonRefresh />
            <NavigationProfile />
        </div>
    );
}
