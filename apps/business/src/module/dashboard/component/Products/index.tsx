import { useState } from "react";
import { MerchantItem } from "@/module/dashboard/component/MerchantItem";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { ManageBudgetSheet } from "@/module/merchant/component/ManageBudgetSheet";
import * as styles from "./products.css";

export function MyMerchants() {
    const { merchants } = useMyMerchants();
    const [budgetMerchantId, setBudgetMerchantId] = useState<string | null>(
        null
    );

    return (
        <>
            <section className={styles.merchantGrid}>
                {merchants.map((merchant) => (
                    <MerchantItem
                        key={merchant.id}
                        merchantId={merchant.id}
                        name={merchant.name}
                        domain={merchant.domain}
                        onManageBudget={() => setBudgetMerchantId(merchant.id)}
                    />
                ))}
            </section>
            {budgetMerchantId && (
                <ManageBudgetSheet
                    merchantId={budgetMerchantId}
                    onClose={() => setBudgetMerchantId(null)}
                />
            )}
        </>
    );
}
