import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import type { SendTransactionTxType } from "@frak-labs/nexus-sdk/core";
import { WalletAddress } from "@module/component/HashDisplay";
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

                        {tx.value && BigInt(tx.value) > 0n ? (
                            <p>Amount: ${formatEther(BigInt(tx.value))}</p>
                        ) : null}

                        {tx.data && tx.data.length > 0 ? (
                            <p>Data: {tx.data}</p>
                        ) : null}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
