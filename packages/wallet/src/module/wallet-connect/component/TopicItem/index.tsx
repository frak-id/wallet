import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { getSdkError } from "@walletconnect/utils";
import { Trash2 } from "lucide-react";
import styles from "./index.module.css";

type TopicItemProps = {
    topic: string;
    name?: string;
    icon?: string;
    url?: string;
    onClick?: () => void;
};

export function TopicItem({ topic, name, icon, url, onClick }: TopicItemProps) {
    const { walletConnectInstance } = useWalletConnect();

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
                onClick={async () => {
                    await walletConnectInstance?.disconnectSession({
                        topic,
                        reason: getSdkError("USER_DISCONNECTED"),
                    });
                    onClick?.();
                }}
            >
                <Trash2 size={24} />
            </button>
        </li>
    );
}
