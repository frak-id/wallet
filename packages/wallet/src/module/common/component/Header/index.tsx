"use client";

import { LogoFrak } from "@/assets/icons/LogoFrak";
import { Nexus } from "@/assets/icons/Nexus";
import { Navigation } from "@/module/common/component/Navigation";
import { Panel } from "@/module/common/component/Panel";
import Link from "next/link";
import styles from "./index.module.css";
import { HeaderWallet } from "@/module/common/component/HeaderWallet";

export function Header({ authenticated = true }: { authenticated?: boolean }) {
    return (
        <>
            <Panel variant={"outlined"}>
                <header className={styles.header}>
                    <Link href={"/wallet"}>
                        <LogoFrak className={styles.header__logo} />
                    </Link>
                    <h1 className={styles.header__title}>
                        <Nexus />
                    </h1>
                    {authenticated && <HeaderWallet />}
                </header>
            </Panel>
            {authenticated && (
                <Panel variant={"outlined"}>
                    <Navigation />
                </Panel>
            )}
        </>
    );
}
