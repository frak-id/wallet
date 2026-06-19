import type { SendTransactionTxType } from "@frak-labs/core-sdk";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { formatEther } from "viem";
import { WalletAddress } from "@/module/component/WalletAddress";
import * as styles from "./index.css";

export function AccordionTransactions({
    txs,
}: {
    txs: SendTransactionTxType[];
}) {
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
                    <AccordionContent>
                        <Stack space="xs">
                            <Text variant="bodySmall">
                                To:{" "}
                                <WalletAddress
                                    wallet={tx.to}
                                    copiedText={t("common.copied")}
                                />
                            </Text>

                            {tx.value && BigInt(tx.value) > 0n ? (
                                <Text variant="bodySmall">
                                    Amount: ${formatEther(BigInt(tx.value))}
                                </Text>
                            ) : null}

                            {tx.data && tx.data.length > 0 ? (
                                <Stack space="xxs">
                                    <Text variant="bodySmall">Data:</Text>
                                    <div
                                        className={
                                            styles.accordionTransactions__data
                                        }
                                    >
                                        {tx.data}
                                    </div>
                                </Stack>
                            ) : null}
                        </Stack>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
