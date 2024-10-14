import { Panel } from "@/module/common/component/Panel";
import { Balance } from "@/module/tokens/component/Balance";
import { HandCoins, Send } from "lucide-react";
import Link from "next/link";
import styles from "./index.module.css";

export function Tokens() {
    return (
        <Panel size={"small"}>
            <Balance />
            <div className={styles.tokens__buttons}>
                <Link
                    href={"/tokens/receive"}
                    className={`button ${styles.tokens__button}`}
                >
                    <HandCoins size={56} absoluteStrokeWidth={true} />
                    Receive
                </Link>
                <Link
                    href={"/tokens/send"}
                    className={`button ${styles.tokens__button}`}
                >
                    <Send size={56} absoluteStrokeWidth={true} />
                    Send
                </Link>
            </div>
        </Panel>
    );
}
