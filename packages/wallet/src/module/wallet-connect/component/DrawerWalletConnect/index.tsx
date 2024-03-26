import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
} from "@/module/common/component/Drawer";
import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import styles from "./index.module.css";

export function DrawerWalletConnect({
    trigger,
    children,
}: PropsWithChildren<{ trigger: ReactNode }>) {
    return (
        <Drawer>
            <DrawerTrigger
                className={styles.drawerWalletConnect__trigger}
                asChild
            >
                <button type={"button"} className={"button"}>
                    {trigger}
                </button>
            </DrawerTrigger>
            <DrawerContent>{children}</DrawerContent>
        </Drawer>
    );
}
