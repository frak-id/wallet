import { Title } from "@/module/common/component/Title";
import { AlertDialogWalletConnect } from "@/module/wallet-connect/component/AlertDialogWalletConnect";
import { DrawerWalletConnect } from "@/module/wallet-connect/component/DrawerWalletConnect";
import { TopicItem } from "@/module/wallet-connect/component/TopicItem";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useMediaQuery } from "@uidotdev/usehooks";
import styles from "./index.module.css";

export default function SessionsList() {
    const { sessions, setSessions } = useWalletConnect();

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop
        ? AlertDialogWalletConnect
        : DrawerWalletConnect;

    return (
        sessions.length > 0 && (
            <Component
                trigger={<Title>List of sessions ({sessions.length})</Title>}
            >
                <ul className={styles.sessionsList}>
                    {sessions.map((session) => {
                        const { name, icons, url } =
                            session.peer.metadata ?? {};
                        return (
                            <TopicItem
                                key={session.topic}
                                topic={session.topic}
                                name={name}
                                icon={icons?.[0]}
                                url={url}
                                onClick={() => {
                                    const newSessions = sessions.filter(
                                        (originSession) =>
                                            originSession.topic !==
                                            session.topic
                                    );
                                    setSessions(newSessions);
                                }}
                            />
                        );
                    })}
                </ul>
            </Component>
        )
    );
}
