import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { ExternalLink } from "lucide-react";
import { polygonMumbai } from "viem/chains";
import styles from "./index.module.css";

const polygonMumbaiUrl = polygonMumbai.blockExplorers.default.url;

export function PolygonLink({ txHash }: { txHash: string }) {
    return (
        <a
            href={`${polygonMumbaiUrl}/tx/${txHash}`}
            target={"_blank"}
            rel={"noreferrer"}
            className={styles.polygonLink}
        >
            {formatHash(txHash)}
            <ExternalLink size={16} />
        </a>
    );
}
