import { Title } from "@/module/common/component/Title";
import { AlertDialogWalletConnect } from "@/module/wallet-connect/component/AlertDialogWalletConnect";
import { DrawerWalletConnect } from "@/module/wallet-connect/component/DrawerWalletConnect";
import { TopicItem } from "@/module/wallet-connect/component/TopicItem";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useMediaQuery } from "@uidotdev/usehooks";
import styles from "./index.module.css";

export default function PairingsList() {
    const { pairings, setPairings } = useWalletConnect();

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop
        ? AlertDialogWalletConnect
        : DrawerWalletConnect;

    return (
        pairings.length > 0 && (
            <Component
                trigger={<Title>List of pairings ({pairings.length})</Title>}
            >
                <ul className={styles.pairingsList}>
                    {pairings.map((pairing) => {
                        const { name, icons, url } = pairing.peerMetadata ?? {};
                        return (
                            <TopicItem
                                key={pairing.topic}
                                topic={pairing.topic}
                                name={name}
                                icon={icons?.[0]}
                                url={url}
                                onClick={() => {
                                    const newPairings = pairings.filter(
                                        (originPairing) =>
                                            originPairing.topic !==
                                            pairing.topic
                                    );
                                    setPairings(newPairings);
                                }}
                            />
                        );
                    })}
                </ul>
            </Component>
        )
    );
}
