import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { ExternalLink } from "lucide-react";
import { polygonMumbai } from "viem/chains";
import styles from "./index.module.css";

const polygonMumbaiUrl = polygonMumbai.blockExplorers.default.url;

export function PolygonLink({
    hash,
    wallet = false,
    icon = true,
}: { hash: string; wallet?: boolean; icon?: boolean }) {
    return (
        <a
            href={`${polygonMumbaiUrl}/${wallet ? "address" : "tx"}/${hash}`}
            target={"_blank"}
            rel={"noreferrer"}
            className={styles.polygonLink}
        >
            {formatHash(hash)}
            {icon && <ExternalLink size={16} />}
        </a>
    );
}
