"use client";

import { LogoFrak } from "@/assets/icons/LogoFrak";
import { Nexus } from "@/assets/icons/Nexus";
import { HeaderWallet } from "@/module/common/component/HeaderWallet";
import { Navigation } from "@/module/common/component/Navigation";
import { Panel } from "@/module/common/component/Panel";
import Link from "next/link";
import styles from "./index.module.css";

export function Header({ authenticated = true }: { authenticated?: boolean }) {
    return (
        <>
            <Panel
                variant={"outlined"}
                size={"small"}
                className={styles.header__panel}
            >
                <header className={styles.header}>
                    <Link href={"/wallet"} className={styles.header__logo}>
                        <LogoFrak />
                    </Link>
                    <h1 className={styles.header__title}>
                        <Nexus />
                    </h1>
                    {authenticated && <HeaderWallet />}
                </header>
            </Panel>
            {authenticated && (
                <Panel
                    variant={"outlined"}
                    size={"small"}
                    className={styles.header__panel}
                >
                    <Navigation />
                </Panel>
            )}
        </>
    );
}
