import { Text } from "@frak-labs/design-system/components/Text";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MerchantItem } from "@/module/dashboard/component/MerchantItem";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { ManageBudgetSheet } from "@/module/merchant/component/ManageBudgetSheet";
import * as styles from "./products.css";

export function MyMerchants() {
    const { t } = useTranslation();
    const { accessibleMerchants, readOnlyMerchants } = useMyMerchants();
    const [budgetMerchantId, setBudgetMerchantId] = useState<string | null>(
        null
    );

    return (
        <>
            <Tiles
                as="section"
                columns={{ mobile: 1, tablet: 2, desktop: 3 }}
                space="m"
            >
                {accessibleMerchants.map((merchant) => (
                    <MerchantItem
                        key={merchant.id}
                        merchantId={merchant.id}
                        name={merchant.name}
                        domain={merchant.domain}
                        isReadOnly={false}
                        isAffiliate={merchant.isAffiliate}
                        onManageBudget={() => setBudgetMerchantId(merchant.id)}
                    />
                ))}
            </Tiles>
            {readOnlyMerchants.length > 0 && (
                <section className={styles.readOnlySection}>
                    <Text
                        as="h2"
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                        className={styles.readOnlyTitle}
                    >
                        {t("platformAdmin.readOnlySectionTitle")}
                    </Text>
                    <Tiles
                        columns={{ mobile: 1, tablet: 2, desktop: 3 }}
                        space="m"
                    >
                        {readOnlyMerchants.map((merchant) => (
                            <MerchantItem
                                key={merchant.id}
                                merchantId={merchant.id}
                                name={merchant.name}
                                domain={merchant.domain}
                                isReadOnly={true}
                                isAffiliate={merchant.isAffiliate}
                                onManageBudget={() =>
                                    setBudgetMerchantId(merchant.id)
                                }
                            />
                        ))}
                    </Tiles>
                </section>
            )}
            {budgetMerchantId && (
                <ManageBudgetSheet
                    merchantId={budgetMerchantId}
                    onClose={() => setBudgetMerchantId(null)}
                />
            )}
        </>
    );
}
