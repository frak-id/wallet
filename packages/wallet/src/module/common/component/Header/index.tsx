"use client";

import { Navigation } from "@/module/common/component/Navigation";
import { LogoFrakWithName } from "@frak-labs/shared/module/asset/icons/LogoFrakWithName";
import { ButtonRefresh } from "@module/component/ButtonRefresh";
import Link from "next/link";
import styles from "./index.module.css";

export function Header({
    navigation = true,
}: { navigation?: boolean; authenticated?: boolean }) {
    return (
        <>
            <header className={styles.header}>
                <h1>
                    <Link href={"/wallet"} className={styles.header__logo}>
                        <LogoFrakWithName />
                    </Link>
                </h1>
                <ButtonRefresh className={styles.header__buttonRefresh} />
            </header>
            {navigation && <Navigation />}
        </>
    );
}
