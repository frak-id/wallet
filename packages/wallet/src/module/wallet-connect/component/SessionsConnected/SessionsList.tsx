import { AlertDialog } from "@/module/common/component/AlertDialog";
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
} from "@/module/common/component/Drawer";
import { Title } from "@/module/common/component/Title";
import { SessionItem } from "@/module/wallet-connect/component/SessionsConnected/SessionItem";
import { useWalletConnectSessions } from "@/module/wallet-connect/hook/useWalletConnectSessions";
import { useMediaQuery } from "@uidotdev/usehooks";
import { first } from "radash";
import { type PropsWithChildren, type ReactNode, useMemo } from "react";
import styles from "./index.module.css";

export function SessionsList() {
    const sessions = useWalletConnectSessions();

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop
        ? AlertDialogWalletConnect
        : DrawerWalletConnect;

    // Map every session to a displayable item
    const mappedSessions = useMemo(() => {
        return sessions.map((session) => {
            const { name, icon, url } = {
                name: session.peer.metadata.name,
                url: session.peer.metadata.url,
                icon: first(session.peer.metadata.icons) ?? undefined,
            };

            return (
                <SessionItem
                    key={session.topic}
                    topic={session.topic}
                    name={name}
                    icon={icon}
                    url={url}
                />
            );
        });
    }, [sessions]);

    return (
        sessions.length > 0 && (
            <Component
                trigger={<Title>List of sessions ({sessions.length})</Title>}
            >
                <ul className={styles.sessionsList}>{mappedSessions}</ul>
            </Component>
        )
    );
}

function AlertDialogWalletConnect({
    trigger,
    children,
}: PropsWithChildren<{ trigger: ReactNode }>) {
    return (
        <AlertDialog
            text={children}
            button={{
                label: trigger,
                className: styles.alertDialogWalletConnect,
            }}
        />
    );
}

function DrawerWalletConnect({
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
