import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { CircleDollarSign, HandCoins, Send } from "lucide-react";
import Link from "next/link";
import { TokenList } from "../TokenList";
import styles from "./index.module.css";

export function Tokens() {
    return (
        <Panel withShadow={true} size={"small"}>
            <Title icon={<CircleDollarSign width={32} height={32} />}>
                Tokens
            </Title>
            <TokenList />
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
