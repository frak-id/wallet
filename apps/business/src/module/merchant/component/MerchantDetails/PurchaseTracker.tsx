import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { Title } from "@/module/common/component/Title";
import { usePurchaseWebhookStatus } from "@/module/merchant/hook/usePurchaseWebhookStatus";
import styles from "./PurchaseTracker.module.css";
import { PurchaseTrackerWebhook } from "./PurchaseTrackerWebhook";

export function PurchasseTrackerSetup({ merchantId }: { merchantId: string }) {
    return (
        <PanelAccordion
            title="Purchase Tracker"
            id={"purchaseTracker"}
            className={styles.purchaseOracleSetup}
        >
            <p className={styles.purchaseTracker__description}>
                The purchase tracker will permit to create campaigns and
                distribute rewards based on user purchase on your website.
            </p>
            <PurchasseTrackerAccordionContent merchantId={merchantId} />
        </PanelAccordion>
    );
}

function PurchasseTrackerAccordionContent({
    merchantId,
}: {
    merchantId: string;
}) {
    const { data: webhookStatus, isLoading } = usePurchaseWebhookStatus({
        merchantId,
    });

    if (isLoading) {
        return <Spinner />;
    }

    return (
        <div className={styles.purchaseTrackerAccordionContent}>
            <PurchaseTrackerWebhook merchantId={merchantId} />
            {webhookStatus?.setup && webhookStatus.stats && (
                <WebhookStats stats={webhookStatus.stats} />
            )}
        </div>
    );
}

function WebhookStats({
    stats,
}: {
    stats: {
        firstPurchase?: Date;
        lastPurchase?: Date;
        lastUpdate?: Date;
        totalPurchaseHandled?: number;
    };
}) {
    return (
        <Columns>
            <Column size={"full"}>
                <Title as={"h3"}>Stats</Title>
                <p>
                    First purchase: {stats.firstPurchase?.toString() ?? "N/A"}
                </p>
                <p>Last purchase: {stats.lastPurchase?.toString() ?? "N/A"}</p>
                <p>Last update: {stats.lastUpdate?.toString() ?? "N/A"}</p>
                <p>
                    Total purchase handled:{" "}
                    {stats.totalPurchaseHandled ?? "N/A"}
                </p>
            </Column>
        </Columns>
    );
}
