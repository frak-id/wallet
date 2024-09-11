"use client";

import { Nexus } from "@/assets/icons/Nexus";
import { HeaderWallet } from "@/module/common/component/HeaderWallet";
import { Navigation } from "@/module/common/component/Navigation";
import { LogoFrak } from "@frak-labs/shared/module/asset/icons/LogoFrak";
import { ButtonRefresh } from "@module/component/ButtonRefresh";
import Link from "next/link";
import styles from "./index.module.css";

export function Header({
    navigation = true,
    authenticated = false,
}: { navigation?: boolean; authenticated?: boolean }) {
    return (
        <>
            <header className={styles.header}>
                <Link href={"/wallet"} className={styles.header__logo}>
                    <LogoFrak />
                </Link>
                <h1 className={styles.header__title}>
                    <Nexus />
                </h1>
                {authenticated && <HeaderWallet />}
                <ButtonRefresh className={styles.header__buttonRefresh} />
            </header>
            {navigation && <Navigation />}
        </>
    );
}
