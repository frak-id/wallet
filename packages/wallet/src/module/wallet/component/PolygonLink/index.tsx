import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { ExternalLink } from "lucide-react";
import { arbitrumSepolia } from "viem/chains";
import styles from "./index.module.css";

const arbSepoliaExplorerUrl = arbitrumSepolia.blockExplorers.default.url;

export function ExplorerLink({
    hash,
    wallet = false,
    icon = true,
    className = "",
    text = "",
}: {
    hash: string;
    wallet?: boolean;
    icon?: boolean;
    className?: string;
    text?: string;
}) {
    return (
        <a
            href={`${arbSepoliaExplorerUrl}/${
                wallet ? "address" : "tx"
            }/${hash}`}
            target={"_blank"}
            rel={"noreferrer"}
            className={`${styles.polygonLink} ${className}`}
        >
            {text ? <span>{text}</span> : <span>{formatHash(hash)}</span>}
            {icon && <ExternalLink className={styles.polygonLink__icon} />}
        </a>
    );
}
