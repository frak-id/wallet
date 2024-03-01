import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { ExternalLink } from "lucide-react";
import { polygonMumbai } from "viem/chains";
import styles from "./index.module.css";

const polygonMumbaiUrl = polygonMumbai.blockExplorers.default.url;

export function PolygonLink({
    hash,
    wallet = false,
    icon = true,
    className = "",
}: { hash: string; wallet?: boolean; icon?: boolean; className?: string }) {
    return (
        <a
            href={`${polygonMumbaiUrl}/${wallet ? "address" : "tx"}/${hash}`}
            target={"_blank"}
            rel={"noreferrer"}
            className={`${styles.polygonLink} ${className}`}
        >
            <span>{formatHash(hash)}</span>
            {icon && <ExternalLink className={styles.polygonLink__icon} />}
        </a>
    );
}
