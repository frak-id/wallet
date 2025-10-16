import { isRunningInProd } from "@frak-labs/app-essentials";
import { formatHash } from "@frak-labs/ui/component/HashDisplay";
import { ExternalLink } from "lucide-react";
import type { Hex } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import styles from "./index.module.css";

const explorerUrl = isRunningInProd
    ? arbitrum.blockExplorers.default.url
    : arbitrumSepolia.blockExplorers.default.url;

export function ExplorerTxLink({
    hash,
    icon = true,
    className = "",
    text = "",
}: {
    hash: Hex;
    icon?: boolean;
    className?: string;
    text?: string;
}) {
    return (
        <a
            href={`${explorerUrl}/tx/${hash}`}
            target={"_blank"}
            rel={"noreferrer"}
            className={`${styles.explorerLink} ${className}`}
        >
            {text ? <span>{text}</span> : <span>{formatHash({ hash })}</span>}
            {icon && <ExternalLink className={styles.explorerLink__icon} />}
        </a>
    );
}
