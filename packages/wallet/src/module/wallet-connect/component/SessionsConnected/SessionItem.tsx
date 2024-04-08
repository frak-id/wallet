import { useInvalidateWalletConnectSessions } from "@/module/wallet-connect/hook/useWalletConnectSessions";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useMutation } from "@tanstack/react-query";
import { getSdkError } from "@walletconnect/utils";
import { Trash2 } from "lucide-react";
import styles from "./index.module.css";

type SessionItemProps = {
    topic: string;
    name?: string;
    icon?: string;
    url?: string;
};

export function SessionItem({ topic, name, icon, url }: SessionItemProps) {
    const { walletConnectInstance } = useWalletConnect();
    const invalidateWalletConnectSessions =
        useInvalidateWalletConnectSessions();

    const { mutate: onClick } = useMutation({
        mutationKey: ["delete-wc-session", topic],
        mutationFn: async () => {
            console.log("Disconnecting session");
            // Ask the wallet connect instance to remove the session
            await walletConnectInstance?.disconnectSession({
                topic,
                reason: getSdkError("USER_DISCONNECTED"),
            });
            // Invalidate the sessions query
            await invalidateWalletConnectSessions();
        },
    });

    return (
        <li className={styles.topicItem}>
            {icon && (
                <span>
                    <img src={icon} alt={""} width={32} />
                </span>
            )}
            <span>
                {name ?? "Unknown"}
                <br />
                {url && (
                    <a href={url} target={"_blank"} rel={"noreferrer"}>
                        {new URL(url).hostname}
                    </a>
                )}
            </span>
            <button
                type={"button"}
                className={`button ${styles.topicItem__button}`}
                title={"Disconnect"}
                onClick={() => onClick()}
            >
                <Trash2 size={24} />
            </button>
        </li>
    );
}
