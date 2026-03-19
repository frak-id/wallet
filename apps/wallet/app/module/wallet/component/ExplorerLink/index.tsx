import { isRunningInProd } from "@frak-labs/app-essentials";
import { ExternalLink } from "lucide-react";
import type { Hex } from "viem";
import { slice } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import * as styles from "./index.css";

const explorerUrl = isRunningInProd
    ? arbitrum.blockExplorers.default.url
    : arbitrumSepolia.blockExplorers.default.url;

function formatHash({
    hash,
    format = { start: 2, end: 3 },
}: {
    hash: Hex;
    format?: { start: number; end: number };
}) {
    if (!hash) return undefined;
    const start = slice(hash, 0, format.start);
    const end = slice(hash, -format.end).replace("0x", "");
    return `${start}...${end}`;
}

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
            {icon && <ExternalLink className={styles.explorerLinkIcon} />}
        </a>
    );
}
