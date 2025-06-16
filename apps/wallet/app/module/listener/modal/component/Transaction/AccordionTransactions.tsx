import type { SendTransactionTxType } from "@frak-labs/core-sdk";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/ui/component/Accordion";
import { WalletAddress } from "@frak-labs/ui/component/HashDisplay";
import { useTranslation } from "react-i18next";
import { formatEther } from "viem";
import styles from "./index.module.css";

export function AccordionTransactions({
    txs,
}: { txs: SendTransactionTxType[] }) {
    const { t } = useTranslation();
    return (
        <Accordion
            type={"single"}
            collapsible
            defaultValue={"transaction-0"}
            className={styles.accordionTransactions__container}
        >
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
                            To:{" "}
                            <WalletAddress
                                wallet={tx.to}
                                copiedText={t("common.copied")}
                            />
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
