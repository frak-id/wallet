import { currentStablecoins, type Stablecoin } from "@frak-labs/app-essentials";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { Address } from "viem";
import { Panel } from "@/module/common/component/Panel";
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import { FormLayout } from "@/module/forms/Form";
import { MerchantHead } from "@/module/merchant/component/MerchantHead";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { AllowedDomainsSheet } from "../AllowedDomainsSheet";
import { MerchantEditSheet } from "../MerchantEditSheet";
import { ExplorerSettings } from "./ExplorerSettings";
import * as styles from "./merchant-summary.css";
import { PurchasseTrackerSetup } from "./PurchaseTracker";

const DOMAIN_PREVIEW_COUNT = 3;

function detectStablecoinFromAddress(address: Address): Stablecoin | undefined {
    for (const [key, value] of Object.entries(currentStablecoins)) {
        if (value.toLowerCase() === address.toLowerCase()) {
            return key as Stablecoin;
        }
    }
    return undefined;
}

export function MerchantDetails({ merchantId }: { merchantId: string }) {
    const { data: merchant } = useMerchant({ merchantId });

    const stablecoin = merchant
        ? (detectStablecoinFromAddress(merchant.defaultRewardToken) ?? "eure")
        : undefined;
    const currency = stablecoin ? currencyMetadata[stablecoin] : undefined;

    return (
        <FormLayout>
            <MerchantHead merchantId={merchantId} />
            {merchant && (
                <Panel title={"Details of the merchant"}>
                    <Stack space="m">
                        <Row label="Name" value={merchant.name} />
                        <Row label="Domain" value={merchant.domain} />
                        <Row
                            label="Default reward currency"
                            value={
                                currency ? (
                                    <>
                                        {currency.label}
                                        <span className={styles.providerBadge}>
                                            {currency.provider}
                                        </span>
                                    </>
                                ) : (
                                    "—"
                                )
                            }
                        />
                        <div className={styles.summaryActions}>
                            <MerchantEditSheet
                                merchant={merchant}
                                merchantId={merchantId}
                            />
                        </div>
                    </Stack>
                </Panel>
            )}
            {merchant && (
                <Panel title={"Allowed domains"}>
                    <Stack space="m">
                        <p className={styles.summaryDescription}>
                            Additional domains authorized to access this
                            merchant (e.g. Shopify myshopify.com domains).
                        </p>
                        {merchant.allowedDomains.length > 0 ? (
                            <div className={styles.domainTagList}>
                                {merchant.allowedDomains
                                    .slice(0, DOMAIN_PREVIEW_COUNT)
                                    .map((domain) => (
                                        <span
                                            key={domain}
                                            className={styles.domainTag}
                                        >
                                            {domain}
                                        </span>
                                    ))}
                                {merchant.allowedDomains.length >
                                    DOMAIN_PREVIEW_COUNT && (
                                    <span className={styles.domainTag}>
                                        +
                                        {merchant.allowedDomains.length -
                                            DOMAIN_PREVIEW_COUNT}{" "}
                                        more
                                    </span>
                                )}
                            </div>
                        ) : (
                            <p className={styles.summaryDescription}>
                                No additional domains yet.
                            </p>
                        )}
                        <div className={styles.summaryActions}>
                            <AllowedDomainsSheet
                                merchantId={merchantId}
                                allowedDomains={merchant.allowedDomains}
                            />
                        </div>
                    </Stack>
                </Panel>
            )}
            <ExplorerSettings merchantId={merchantId} />
            <PurchasseTrackerSetup merchantId={merchantId} />
        </FormLayout>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryValue}>{value}</span>
        </div>
    );
}
