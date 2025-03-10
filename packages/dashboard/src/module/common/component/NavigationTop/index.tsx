"use client";

// import { Calendar } from "@/assets/icons/Calendar";
// import { Envelope } from "@/assets/icons/Envelope";
// import { Notification } from "@/assets/icons/Notification";
// import { Search } from "@/assets/icons/Search";
import { NavigationProfile } from "@/module/common/component/NavigationProfile";
import { ButtonRefresh } from "@shared/module/component/ButtonRefresh";
// import { useRouter } from "next/navigation";
// import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function NavigationTop() {
    return (
        <div className={styles.navigationTop__container}>
            {/*<nav>
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
            </nav>*/}
            <ButtonRefresh />
            <NavigationProfile />
        </div>
    );
}

// type NavigationTopItemProps = {
//     url: string;
// };

// function NavigationTopItem({
//     children,
//     url,
// }: PropsWithChildren<NavigationTopItemProps>) {
//     const router = useRouter();
//
//     return (
//         <li>
//             <button
//                 type={"button"}
//                 className={`${styles.navigationTopItem__button}`}
//                 onClick={() => router.push(url)}
//             >
//                 {children}
//             </button>
//         </li>
//     );
// }
