import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { ExternalLink } from "lucide-react";
import { polygonAmoy } from "viem/chains";
import styles from "./index.module.css";

const polygonAmoyUrl = polygonAmoy.blockExplorers.default.url;

export function PolygonLink({
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
            href={`${polygonAmoyUrl}/${wallet ? "address" : "tx"}/${hash}`}
            target={"_blank"}
            rel={"noreferrer"}
            className={`${styles.polygonLink} ${className}`}
        >
            {text ? <span>{text}</span> : <span>{formatHash(hash)}</span>}
            {icon && <ExternalLink className={styles.polygonLink__icon} />}
        </a>
    );
}
