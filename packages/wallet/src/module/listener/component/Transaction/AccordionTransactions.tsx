import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import type { SendTransactionTxType } from "@frak-labs/nexus-sdk/core";
import { formatEther } from "viem";
import styles from "./index.module.css";

export function AccordionTransactions({
    txs,
}: { txs: SendTransactionTxType[] }) {
    return (
        <Accordion type={"single"} collapsible defaultValue={"transaction-0"}>
            {txs.map((tx, index) => (
                <AccordionItem
                    key={`${index}-${tx.to}`}
                    value={`transaction-${index}`}
                >
                    <AccordionTrigger
                        className={styles.accordionTransactions__trigger}
                    >
                        Transaction {index + 1}
                    </AccordionTrigger>
                    <AccordionContent
                        className={styles.accordionTransactions__content}
                    >
                        <p>
                            To: <WalletAddress wallet={tx.to} />
                        </p>

                        {BigInt(tx.value) > 0n ? (
                            <p>Amount: ${formatEther(BigInt(tx.value))}</p>
                        ) : null}

                        {BigInt(tx.data.length) > 0n ? (
                            <p>Data: {tx.data}</p>
                        ) : null}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
